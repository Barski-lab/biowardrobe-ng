import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

import { Log } from '../logger';
import { moduleLoader } from './moduleloader';
import { BaseModuleInterface } from './base.module.interface';
import { passMonitor$ } from '../accounts';

const crypto = require('crypto');
const path = require('path');
const request = require('request');
const htmlparser = require('htmlparser2');
// const url = require('url');

interface paramsFormat {
    email: string;
    login: string;
    pass: string;
    userId: string;
    session?: string;
    forceLogin?: boolean;
}

/**
 * List of module parameters
 */
interface Info {
    moduleId: string;
    caption?: string;
    type?: string;
    loginUrl?: string;
    viewListUrl?: string;
    downloadUrl?: string;
    private_key?:  string;
    private_iv?:  string;
    encryptKey?: string;
    token?: string;
    protocol?: string;
    collection?: any;
    publication?: string;
    refreshSessionInterval?: number;
}

const moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf("."));

export function getCollectionParams (collectionNameDefault: string, nullConnectionDefault: boolean){
    if (   Meteor.settings
        && Meteor.settings.remotes
        && Meteor.settings.remotes[moduleId]
        && Meteor.settings.remotes[moduleId].collection
        && Meteor.settings.remotes[moduleId].collection.name != undefined
        && Meteor.settings.remotes[moduleId].collection.nullConnection != undefined){
        return {"name": Meteor.settings.remotes[moduleId].collection.name, "nullConnection": Meteor.settings.remotes[moduleId].collection.nullConnection}
    } else {
        return {"name": collectionNameDefault, "nullConnection": nullConnectionDefault}
    }
}

let collectionParams = getCollectionParams ( "postform_storage", false);

export const ModuleCollection: any = collectionParams.nullConnection
    ? new Mongo.Collection(collectionParams.name, {"connection": null}) : new Mongo.Collection(collectionParams.name);

ModuleCollection.deny({
    insert: function () {
        return true;
    },
    update: function () {
        return true;
    },
    remove: function () {
        return true;
    }
});

/**
 *
 */
class PostFormModule implements BaseModuleInterface {

    private _info: Info = null;
    private _intervalId;
    private _passChangeSubscription;

    /**
     *
     */
    constructor (){
        this.loadSettings();

        if (!this._info.caption) { return; }

        this._passChangeSubscription = passMonitor$
            .subscribe((p) => {
                p['forceLogin'] = true; // Force login first time, use session after
                this.updateFileStorage(p).catch((e) => Log.error(e));
            });

        this._intervalId = Meteor.setInterval(() => {
            ModuleCollection
                .find({"active": true})
                .forEach(item => {
                    this.updateFileStorage({
                        email:  item.email,
                        login:  item.login,
                        pass:   this.simpleDecrypt(item['param']),
                        userId: item.userId,
                        session: item.session
                    }).catch((e) => Log.error(e));
                })
        }, this._info.refreshSessionInterval*1000);

        // Give access to localhost to get details about authorized user
        WebApp.rawConnectHandlers.use('/coredata', Meteor.bindEnvironment((req, res, next) => {
            res.writeHead(200,{ 'Content-Type': 'text/plain'});
            if(req.connection.remoteAddress!='127.0.0.1') {
                res.end('');
                return next();
            }
            Log.debug('[Query]:',req.query);
            if(!req.query || !req.query['token'] || req.query['token'] !== this._info.token ) {
                res.end('');
                return next();
            }
            if(req.query && req.query['email']) {
                let data = ModuleCollection.findOne({"email":req.query['email'].toLowerCase()});
                if(data) {
                    Log.debug('[CoreData]:', data);
                    res.write(`${data['login']}\t${data['email']}\t${data['session']}\t${this.simpleDecrypt(data['param'])}\n`);
                }
            }
            res.end('');
            return next();
        }));
    }

    /**
     * Load default settings from config, if no setting throw exception?
     */
    private loadSettings () {
        this._info = Meteor.settings.remotes[moduleId] || {};

        this._info = {
            moduleId: moduleId,
            refreshSessionInterval: 600,
            ...this._info
        };
    }

    /**
     *
     * @param data
     * @param key
     * @param iv
     */
    private encrypt (data: string, key: string, iv: string){
        if( !iv || !key ) { return; }
        let cipher = crypto.createCipheriv('aes-128-cbc',
            Buffer.from(key,'base64'),
            Buffer.from(iv, 'base64'));
        cipher.setAutoPadding(true);
        return Buffer.concat([cipher.update(data), cipher.final()]).toString('base64');
    }

    /**
     *
     * @param data
     * @param key
     * @param iv
     */
    private decrypt (data: string, key: string, iv: string) {
        if( !iv || !key ) { return; }
        const decipher = crypto.createDecipheriv('aes-128-cbc',
            Buffer.from(key,'base64'),
            Buffer.from(iv, 'base64'));
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(data, 'base64', 'utf8');
        return decrypted + decipher.final('utf8');
    }

    private simpleDecrypt(paramEncrypted: string) {
        return this.decrypt(paramEncrypted, this._info.private_key, this._info.private_iv);
    }

    /**
     *
     * @param params
     */
    private updateFileStorage (params: paramsFormat) {
        let data = {
            "login": params.login,
            "param": this.encrypt(params.pass, this._info.private_key, this._info.private_iv),
            "email": params.email.toLowerCase(),
            "timestamp": new Date(),
            "modified":  Date.now()/1000.0
        };
        return this.getRawData(params)
            .then(res => this.formFileList(res))
            .then(
                Meteor.bindEnvironment((filesWithSession) => {
                    Log.debug(`Updated for: ${params.login}`);
                    data["active"] = true;
                    data["list"] = {
                        path: '/',
                        files: filesWithSession.files,
                        links: filesWithSession.links,
                        folders: []
                    };
                    data["session"] = filesWithSession.cookies.cookies.find( cookiesObject => {return cookiesObject.key == "PHPSESSID"}).value;
                    ModuleCollection.update({"userId": params.userId}, {$set: data}, {upsert: true});
                }),
                Meteor.bindEnvironment((e)=> {
                    Log.debug("Failed to log in to file storage");
                    data["active"] = false;
                    data["list"] = {
                        path: '/',
                        files: [],
                        links: [],
                        folders: []
                    };
                    data["session"] = null;
                    ModuleCollection.update({"userId": params.userId}, {$set: data}, {upsert: true});
                }))
                .catch((err) => Log.error('updateFileStorage:', err));
    }


    private getRawData(params: paramsFormat) {
        if( params.session && !params.forceLogin) {
            const cookiesJar = request.jar();
            const cookie = request.cookie(`PHPSESSID=${params.session}`);
            cookiesJar.setCookie(cookie, this._info.viewListUrl);
            return this.getRawDataHelper(cookiesJar);
        } else {
            return this.startLoginProcess(params)
                .then((c) => this.getRawDataHelper(c))
                .catch((err) => Log.error('getRawData:', err));
        }
    }

    /**
     *
     * @param params
     */
    private startLoginProcess (params: {login: string, pass: string, session?: string} ){
        return new Promise((resolve, reject) => {
            const cookiesJar = request.jar();
            let _req = {
                method: 'POST',
                uri: this._info.loginUrl,
                jar: cookiesJar,
                followRedirects: true,
                form: {
                    username: params.login,
                    password: params.pass
                }
            };
            request( _req,
                (error, res, body) => {
                    return ( error || /LDAP login failed/.test(body)) ? reject({
                        type: "login",
                        error
                    }) : resolve(cookiesJar);
                }

            );
        });
    }

    /**
     *
     * @param cookiesJar
     */
    private getRawDataHelper (cookiesJar): Promise<any> {
        return new Promise((resolve, reject) => {
            request(
                {
                    method: 'GET',
                    uri: this._info.viewListUrl,
                    jar: cookiesJar,
                },

                (error, res, body) => {
                    return (error || /YOU NEED TO LOGIN TO SEE YOUR RESULTS/.test(body)) ? reject({
                        type: "data",
                        error
                    }) : resolve( {rawData: body, cookies: cookiesJar} );
                }
            );
        });
    }


    /**
     * Parses getRawData output
     * @param rawDataWithSession
     */
    private formFileList (rawDataWithSession) {
        let fileList = [];
        let fileLinks = [];
        let insideListSection = false;

        let parser = new htmlparser.Parser({

            onopentag: (name, attribs) => {
                if(name === "li"){
                    insideListSection = true;
                }
                if (insideListSection && name === "a" && attribs != null && attribs.href != null){
                    if (/downloadFile/.test (attribs.href)) {

                        let startPath = attribs.href.indexOf("('");
                        let stopPath = attribs.href.indexOf("',");
                        let fpath = attribs.href.substring(startPath+2, stopPath);

                        let startName = attribs.href.indexOf(", '");
                        let stopName = attribs.href.indexOf("')");
                        let fname = attribs.href.substring(startName+3, stopName);

                        let link = this._info.downloadUrl + '?file=' + fpath;
                        if (/fastq/.test(fname)){
                            fileList.push (fname);
                            fileLinks.push(link)
                        }
                    }
                }
            },

            onclosetag: function(name){
                if(name === "li"){
                    insideListSection = false;
                }
            }

        }, { decodeEntities: true });

        parser.write(rawDataWithSession.rawData);
        parser.end();

        // Log.debug("formFileList success");
        return Promise.resolve({files: fileList, links: fileLinks, cookies: rawDataWithSession.cookies._jar.toJSON()});
    }

    public getFile(fileUrl: any, userId: any) {
        let basename = path.basename(fileUrl.path);
        let data = ModuleCollection.findOne( { "userId": userId, "list.files":  basename } );
        return { "url": data.list.links[data.list.files.indexOf(basename)], 
                 "basename": basename,
                 "header": `Cookie:session=${data.session}`}
    }

    getInfo () {
        return {
            moduleId: this._info.moduleId,
            caption: this._info.caption,
            protocol: this._info.protocol,
            collection: this._info.collection.name,
            publication: this._info.publication,
            type: this._info.type
        };
    }
}

Meteor.startup(() => {
    moduleLoader.addModule (new PostFormModule());
});

/////
/////   Publications
/////

const ModuleCollectionFields = {
    fields: {
        userId: 1,
        timestamp: 1,
        active: 1,
        list: 1
    }
};

Meteor.publish(`module/${Meteor.settings.remotes[moduleId].publication}`, function () {
    // Return only those document(s) where active is true (the file list is up to date) or where `active` field
    // is not present at all (ModuleCollection has not been automatically updated yet)
    Log.debug(`module/${Meteor.settings.remotes[moduleId].publication}`, this.userId);
    if (this.userId) {
        return ModuleCollection.find( {'userId': this.userId}, ModuleCollectionFields);
    } else {
        this.ready();
    }
});