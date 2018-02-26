import { Meteor } from 'meteor/meteor';
import { AESencrypt, AESdecrypt } from 'meteor/ostrio:aes-crypto';

import { Log } from '../logger';
import { FileStorage } from '../../../collections/shared';
import { moduleLoader } from './moduleloader';
import { BaseModuleInterface } from './base.module.interface';
import { passMonitor$ } from '../accounts';
import {oauth2Model} from "../oauth/oauth2model";

const crypto = require('crypto');
const path = require('path');
const request = require('request');
const htmlparser = require('htmlparser2');


interface paramsFormat {
    email: string;
    login: string;
    pass: string;
    userId: string;
}

/**
 * List of module parameters
 */
interface Info {
    moduleId: string;
    caption: string;
    type: string;
    loginUrl: string;
    viewListUrl: string;
    downloadUrl: string;
    private_key:  string;
    private_iv:  string;
    encryptKey: string,
    token: string,
    auth: {
        "login": string,
        "pass": string
    }
}

class FileStorageModule implements BaseModuleInterface {

    private _info: Info = null;
    private _initialised: boolean = false;
    private app:any = undefined;
    private routes = undefined;

    public get initialised(): boolean {
        return this._initialised;
    }

    private encrypt (data: string, key: string, iv: string){
        // key should be UTF-8 string 16 characters long
        // let iv = key.split("").reverse().join("");
        let cipher = crypto.createCipheriv('aes-128-cbc',
            new Buffer(key,'base64'),
            new Buffer(iv, 'base64'));
        cipher.setAutoPadding(true);
        return Buffer.concat([cipher.update(data), cipher.final()]).toString('base64');
    }

    private decrypt (data: string, key: string, iv: string){
        // key should be UTF-8 string 16 characters long
        // let iv = key.split("").reverse().join("");
        let decipher = crypto.createDecipheriv('aes-128-cbc',
            new Buffer(key,'base64'),
            new Buffer(iv, 'base64'));
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
        // return Buffer.concat([cipher.update(data), cipher.final()]).toString('base64');
    }

    private getAuthOptions (settings){
        try {
            return {
                "login": settings.auth["login"],
                "pass": settings.auth["pass"]
            };
        } catch (err){}
        return null;
    }

    private loadSettings (): Boolean {
        let moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf(".")); // unique module identifier
        let moduleSettings = Meteor.settings.remotes[moduleId];
        this._info = {
            moduleId:    moduleId,
            caption:     moduleSettings["caption"] ? moduleSettings["caption"] : moduleId,
            type:        moduleSettings["type"],                                                           // Should be deprecated later
            loginUrl:    moduleSettings["loginUrl"],
            viewListUrl: moduleSettings["viewListUrl"],
            downloadUrl: moduleSettings["downloadUrl"],
            token: moduleSettings["token"],
            private_key: moduleSettings["private_key"] ? moduleSettings["private_key"] : "",
            private_iv: moduleSettings["private_iv"] ? moduleSettings["private_iv"] : "",
            encryptKey: moduleSettings["encryptKey"] ? moduleSettings["encryptKey"] : "",
            auth:        this.getAuthOptions (moduleSettings)
        };
        this._initialised = true;
        return this._initialised;
    }

    constructor (){
        try {
            this.loadSettings();
            passMonitor$.subscribe((p: paramsFormat) => {
                if (this._info.auth && this._info.auth.login && this._info.auth.pass){
                    p.login = this._info.auth.login;
                    p.pass = this._info.auth.pass;
                }
                this.updateFileStorage (p);
            });
            WebApp.rawConnectHandlers.use('/coredata', Meteor.bindEnvironment((req, res, next) => {
                res.writeHead(200,{ 'Content-Type': 'text/plain'});
                if(req.connection.remoteAddress!='127.0.0.1') {
                    res.end('');
                    return next();
                }
                Log.debug('[Query]:',req.query);
                if(!req.query || !req.query['token'] || req.query['token'] != this._info.token ) {
                    res.end('');
                    return next();
                }
                if(req.query && req.query['email']) {
                    let data=FileStorage.findOne({"email":req.query['email'].toLowerCase()});
                    if(data) {
                        Log.debug('[CoreData]:', data);
                        if(data['param'] &&
                            /^{"ct":"([A-Za-z0-9+\/]+(\={0,2}))","iv":"([0-9a-f]{32})","s"\:"([0-9a-f]{16})"}$/.test(data['param'])) {
                            let de = AESdecrypt(data['param'],this._info.encryptKey);
                            res.write(`${data['login']}\t${data['email']}\t${data['session']}\t${de}\n`);
                        } else {
                            let de = this.decrypt(data['param'], this._info.private_key, this._info.private_iv);
                            res.write(`${data['login']}\t${data['email']}\t${data['session']}\t${de}\n`);
                        }
                    }
                }
                res.end('');
                return next();
            }));
        } catch (err){
            Log.debug("Error module configuration");
        }
    }


    updateFileStorage (params: paramsFormat){
        this.getFileList(params).then((filesWithSession)=> {
            let data = {
                "login": params.login,
                "param": this.encrypt(params.pass, this._info.private_key, this._info.private_iv),
                "email": params.email.toLowerCase(),
                "files": filesWithSession.files,
                "session": filesWithSession.cookies.cookies.find( cookiesObject => {return cookiesObject.key == "PHPSESSID"}).value,
                "timestamp": new Date()
            };
            FileStorage.update(
                {"userId": params.userId},
                { $set: data},
                { upsert: true }
            );
        }, (e)=> {
            Log.debug("Failed to get files from file storage:\n", e);
        })
    }


    getFileList (params: {login: string, pass: string}) {
        return this.getCookiesDefault()
            .then(
                res => {
                    Log.debug("getCookiesDefault success");
                    return this.getCookies(res, params)
                })
            .then(
                res => {
                    Log.debug("getCookies success");
                    return this.getRawData(res)
                })
            .then(
                res => {
                    Log.debug("getRawData success");
                    return Promise.resolve(this.formFileList(res));
                })
    }


    getCookiesDefault (){
        var cookies = request.jar();
        return new Promise((resolve,reject)=>{
            request(
                {
                    method: 'POST',
                    uri: this._info.loginUrl,
                    jar: cookies
                },

                Meteor.bindEnvironment(function(err,res,body)
                    {
                        if (err){
                            reject(err);
                        }
                        resolve(cookies);
                    }
                )
            );
        });
    }


    getCookies (cookies, params: {login: string, pass: string} ){
        return new Promise((resolve,reject)=>{
            request(
                {
                    method: 'POST',
                    uri: this._info.loginUrl,
                    jar: cookies,
                    followRedirects: true,
                    form:
                        {
                            username: params.login,
                            password: params.pass
                        }
                },

                Meteor.bindEnvironment(function(err,res,body)
                    {
                        if (err){
                            reject(err);
                        }
                        resolve(cookies);
                    }
                )
            );
        });
    }


    getRawData (cookies){
        return new Promise((resolve,reject)=>{
            request(
                {
                    method: 'GET',
                    uri: this._info.viewListUrl,
                    jar: cookies,
                },

                Meteor.bindEnvironment(function(err,res,body)
                    {
                        if (err){
                            reject(err)
                        }
                        resolve( {rawData: body, cookies: cookies} );
                    }
                )
            );
        });
    }


    formFileList (rawDataWithSession){
        var fileList = [];
        var insideListSection = false;
        var insideNameSection = false;
        var filename = null;

        var parser = new htmlparser.Parser({

            onopentag: (name, attribs) => {
                if(name === "li"){
                    insideListSection = true;
                }
                if(name === "u" && insideListSection){
                    insideNameSection = true;
                }
                if (insideListSection && name === "a" && attribs != null && attribs.href != null){
                    if (/downloadFile/.test (attribs.href)){

                        var startPath = attribs.href.indexOf("('");
                        var stopPath = attribs.href.indexOf("',");
                        var fpath = attribs.href.substring(startPath+2, stopPath);

                        var startName = attribs.href.indexOf(", '");
                        var stopName = attribs.href.indexOf("')");
                        var fname = attribs.href.substring(startName+3, stopName);

                        var link = this._info.downloadUrl + '?file=' + fpath + '&name=' + fname;
                        if (/fastq/.test(fname)){
                            fileList.push (fname)
                        }
                    }
                }
            },

            onclosetag: function(name){
                if(name === "li"){
                    insideListSection = false;
                }
                if(name === "u"){
                    insideNameSection = false;
                }
            },


            ontext: function(text){
                if (insideListSection && insideNameSection){
                    filename = text;
                }
            },


        }, {decodeEntities: true});

        parser.write(rawDataWithSession.rawData);
        parser.end();

        Log.debug("formFileList success");
        return {files: fileList, cookies: rawDataWithSession.cookies._jar.toJSON()};
    }

    getInfo (){
        return this._info ? _.omit(this._info, ["loginUrl", "viewListUrl", "downloadUrl", "encryptKey", "auth"]) : null;
    }

}

Meteor.startup(() => {
    var fileStorage = new FileStorageModule();
    if (fileStorage.initialised) moduleLoader.addModule (fileStorage);
});