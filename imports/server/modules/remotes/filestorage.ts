import { Meteor } from 'meteor/meteor';
import { AESencrypt, AESdecrypt } from 'meteor/ostrio:aes-crypto';

import { Log } from '../logger';
import { FileStorage } from '../../../collections/shared';
import { moduleLoader } from './moduleloader';
import { BaseModuleInterface } from './base.module.interface';
import { passMonitor$ } from '../accounts';

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
    moduleId: String;
    caption: String;
    type: String;
    loginUrl: String;
    viewListUrl: String;
    downloadUrl: String;
    encryptKey:  String;
    auth: {
        "login": String,
        "pass": String
    }
}

class FileStorageModule implements BaseModuleInterface {

    private _info: Info = null;
    private _initialised: boolean = false;
    public get initialised(): boolean {
        return this._initialised;
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

    private loadSettings (): Boolean{
        let moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf(".")); // unique module identifier
        let moduleSettings = Meteor.settings.remotes[moduleId];
        this._info = {
            moduleId:    moduleId,
            caption:     moduleSettings["caption"] ? moduleSettings["caption"] : moduleId,
            type:        moduleSettings["type"],                                                           // Should be deprecated later
            loginUrl:    moduleSettings["loginUrl"],
            viewListUrl: moduleSettings["viewListUrl"],
            downloadUrl: moduleSettings["downloadUrl"],
            encryptKey:  moduleSettings["encryptKey"] ? moduleSettings["encryptKey"] : Random.secret(10),
            auth:        this.getAuthOptions (moduleSettings)
        };
        this._initialised = true;
    }

    constructor (){
        try {
            this.loadSettings();
            if (!this._info.auth){
                passMonitor$.subscribe((p: paramsFormat) => {
                    this.updateFileStorage (p);
                });
            }
        } catch (err){
            Log.debug("Error module configuration");
        }
    }


    updateFileStorage (params: paramsFormat){
        this.getFileList(params).then((filesWithSession)=> {
            FileStorage.update(
                {"userId": params.userId},
                { $set: {
                    "login": params.login,
                    "param": AESencrypt(params.pass, this._info.encryptKey),
                    "email": params.email,
                    "files": filesWithSession.files,
                    "session": filesWithSession.cookies.cookies.find( cookiesObject => {return cookiesObject.key == "PHPSESSID"}).value,
                    "timestamp": new Date()
                }
                },
                { upsert: true }
            );
        }, (e)=> {
            Log.debug("Failed to get files from file storage:\n", e);
        })
    }


    getFileList (params: {login: string, pass: string}) {
        return this.getCookies(params)
            .then(
                res=> {
                    Log.debug("getCookies success");
                    return this.getRawData(res)
                })
            .then(
                res=> {
                    Log.debug("getRawData success");
                    return Promise.resolve(this.formFileList(res));
                })
    }


    getCookies (params: {login: string, pass: string} ){
        var cookies = request.jar();
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

                        fileList.push ({
                            "name": fname,
                            "link": link
                        })
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