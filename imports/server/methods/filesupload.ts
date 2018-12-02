import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { FileData, FileObj, FilesCollection } from 'meteor/ostrio:files';
import * as jwt from 'jsonwebtoken';

import { Log } from '../../server/modules/logger';
import { connection, DDPConnection } from '../modules/ddpconnection';
import { AccessTokens } from '../../collections/server';

export const FileUploadCollection = new Mongo.Collection('raw_data_files', {  _suppressSameNameError: true } as any);

export const FilesUpload = new FilesCollection({
    collection: FileUploadCollection,
    allowClientCode: false,        // Don't allow to use remove() method on client
    permissions: 0o0664,
    parentDirPermissions: 0o0775,
    continueUploadTTL: 10800,      //This is Default - 10800 seconds = 3 hours

    responseHeaders: (responseCode, fileRef, versionRef) => {
        const headers = {};

        switch (responseCode) {
            case '206':
                headers['Pragma'] = 'private';
                headers['Trailer'] = 'expires';
                headers['Transfer-Encoding'] = 'chunked';
                break;

            case '400':
                headers['Cache-Control'] = 'no-cache';
                break;

            case '416':
                headers['Content-Range'] = `bytes */${versionRef.size}`;
                break;

            default:
                break;
        }

        headers['Connection'] = 'keep-alive';
        headers['Content-Type'] = versionRef.type || 'application/octet-stream';
        headers['Accept-Ranges'] = 'bytes';
        headers['Access-Control-Allow-Origin'] = '*';
        return headers;
    },

    // Files can be downloaded only by authorized users
    // called right before initiate file download
    // return true to continue
    // return false to abort download

    // downloadCallback (fileObj: FileObj) {
    //
    // //     Log.debug("FileUpload downloadCallback", fileObj);
    //     Log.debug(this.userId);
    // //
    //     return !!(this.userId);
    // },

    // Files are served only to authorized users
    // return true to continue
    // return false to abort download
    protected: function (fileObj: FileObj) {

        let telegram: any = {};
        let auth = false;
        if (! this.userId) {
            if(!this.request.query && !this.request.query.token) {
                return false;
            }

            let verifyOptions = {
                subject: "download",
                expiresIn: '1d',
                algorithm: ["ES512"]
            };

            let publicKEY = connection.server_public_key;

            try {
                telegram = jwt.verify(this.request.query.token, publicKEY, verifyOptions);
            } catch (err) {
                throw new Meteor.Error(500, err);
            }

            let selector = {};

            if (telegram.accessToken) {
                selector = { accessToken: telegram.accessToken }
            } else {
                selector = { userId: telegram.userId }
            }
            const user = AccessTokens.findOne(selector);

            if (telegram.sub === 'download' && user) {
                auth = true;
            }
        } else {
            auth = !!this.userId;
        }

        Log.debug(telegram);
        return auth;
    },

    // Files can be uploaded only by authorized users, token in meta authenticates that
    // Callback, triggered right before upload is started on client and right after receiving a chunk on server
    // return true to continue
    // return false or {String} to abort upload
    onBeforeUpload (fileData: FileData|any) {

        Log.debug(fileData);
        if (!fileData || !fileData.meta || !fileData.meta.token) {
            throw new Meteor.Error(500, "No token provided");
        }

        check(fileData.meta.token, String );


        let verifyOptions = {
            algorithm: ["ES512"]
        };

        let publicKEY = connection.server_public_key;
        let telegram: any = {};

        try {
            telegram = jwt.verify(fileData.meta.token, publicKEY, verifyOptions);
        } catch (err) {
            throw new Meteor.Error(500, err);
        }

        Log.debug("JWT verification result:", telegram);

        if (this.userId !== telegram.userId) {
            throw new Meteor.Error(404, "Wrong user!");
        }

        if (fileData._id !== telegram.fileId) {
            throw new Meteor.Error(404, "Wrong fileId!");
        }

        this.file.meta = {
            ...this.file.meta,
            ...telegram
        };
        // JWT verification result:
        // {"userId":"FeZrekod5j5wdPSTk","id":"M6dtqru5szrc8eXSY","projectId":"a4HRDmXhuyK3pkg6d","draft":"626PRNPxrs3QBw8ao","iat":1543405111,"exp":1543491511}

        return !!(this.userId);
    },

    storagePath (fileObj): string {
        let toSavePath:string = Meteor.settings['uploadDirectory'];
        if(fileObj && fileObj.meta && fileObj.meta.storagePath){
            toSavePath = [toSavePath, fileObj.meta.storagePath].join('/').replace(/\/+/g,'/');
        }
        return toSavePath;
    },

    onAfterUpload (fileObj: any){
        if (!DDPConnection.connection) {
            return;
        }
        Log.debug("FilesUpload onAfterRemove:", fileObj);

        if (!fileObj.meta && !fileObj.meta.token && !fileObj.meta.userId) {
            throw new Meteor.Error(404, "no token");
        }

        DDPConnection.call('satellite/file/uploaded', {token: fileObj.meta.token, link: FilesUpload.link(fileObj)})
            .subscribe(() => {
                FileUploadCollection.update({_id: fileObj._id}, {$unset:{"meta.token": 1}, $set:{"meta.synced": Date.now()/1000.0}});
                Log.debug('Updated?');
            });

    }, //Alternatively use: addListener('afterUpload', func)

    onAfterRemove (files:FileObj[]) {
        if (!DDPConnection.connection) {
            return;
        }
        Log.debug("FilesUpload onAfterRemove:", files)
        // DDPConnection.call('satellite/file/removed');
    },

    // namingFunction: function(fileObj:FileObj):string{}, - The Default returns the file's _id entry

});

Meteor.publish('raw_data_files', function () {
    return FilesUpload.find().cursor;
});

Meteor.startup(() => {
    FilesUpload.denyClient(); // Deny insert/update/remove from client
});


Meteor.methods({
    'fileCollectionRemove' (id) {
        check(id, String);
        FilesUpload.remove({_id: id}, (e)=>Log.error(e));
    }
});