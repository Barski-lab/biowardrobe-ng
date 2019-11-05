import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

import { Log } from '../logger';
import { moduleLoader } from './moduleloader';
import { BaseModuleInterface } from './base.module.interface';
import { passMonitor$ } from '../accounts';
import { connection } from '../ddpconnection';
import * as jwt from 'jsonwebtoken';

const path = require('path');
const fs = require('fs');


const moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf("."));

export function getCollectionParams (collectionNameDefault: string, nullConnectionDefault: boolean){
    if (   Meteor.settings
        && Meteor.settings.remotes
        && Meteor.settings.remotes[moduleId]
        && Meteor.settings.remotes[moduleId].collection) {
        return {
            "name": collectionNameDefault,
            "nullConnection": nullConnectionDefault,
            ...Meteor.settings.remotes[moduleId].collection
        }
    }
    return {};
}

let collectionParams = getCollectionParams ( "localfile_storage", false);

export const ModuleCollection: any = collectionParams.nullConnection
    ? new Mongo.Collection(collectionParams.name, {"connection": null}) : new Mongo.Collection(collectionParams.name);
//
// ModuleCollection.deny({
//     insert: function () {
//         return true;
//     },
//     update: function () {
//         return true;
//     },
//     remove: function () {
//         return true;
//     }
// });

/**
 *
 */
class LocalFilesModule implements BaseModuleInterface {

    private _info: any = null;
    private _intervalId;
    private _passChangeSubscription;

    /**
     *
     */
    constructor (){
        this.loadSettings();

        if (!this._info.caption) { return; }

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

    public getFile(fileUrl: any, userId?: any, sampleId?: any) {
        return { "url": path.join( this._info.base_directory, path.resolve("/", decodeURI(fileUrl.path)) ), 
                 "basename": path.basename(fileUrl.path),
                 "header": "copy"}
    }

}

Meteor.startup(() => {
    moduleLoader.addModule (new LocalFilesModule());
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

Meteor.publish(`module/${Meteor.settings.remotes[moduleId].publication}`, function (token, localPath) {

    Log.debug(`module/${Meteor.settings.remotes[moduleId].publication}`, this.userId, token, localPath);

    let verifyOptions = {
        algorithm: ["ES512"]
    };

    let publicKEY = connection.server_public_key;
    let telegram: any = {};

    try {
        telegram = jwt.verify(token, publicKEY, verifyOptions);
    } catch (err) {
        Log.error(err);

        if (!this.userId) {
            this.ready();
            throw new Meteor.Error(500, err);
        }
    }


    check(localPath, String);

    let _localPath = path.resolve('/',localPath).slice(1);

    _localPath = path.resolve(Meteor.settings.remotes[moduleId].base_directory,_localPath);

    let walkADirSync = function(dir) {
        let files = [];
        let folders = [];

        fs.readdirSync(dir).forEach(function(file) {
            const _path = path.join(dir, file);
            if (file.startsWith('.')) {
                return;
            }
            try {
                fs.accessSync(_path, fs.constants.R_OK);
            } catch (err) {
                return;
            }
            const _stat = fs.statSync(_path);

            if (_stat.isDirectory()) {
                folders.push(file);
            }
            else if (_stat.isFile()) {
                files.push(file);
            }

        });
        return {files,folders};
    };
    let data = {};
    data["active"] = true;
    data["userId"] = telegram.userId;
    data["list"] = {
        path: localPath,
        ...walkADirSync(_localPath)
    };
    this.added(`${Meteor.settings.remotes[moduleId].publication}`, localPath, data);

    this.onStop(() => {
        Log.info(`module/${Meteor.settings.remotes[moduleId].publication} publication stop`);
        // handle.stop();
    });

    this.ready();
});