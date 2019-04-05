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


    /**
     * Should provide cors support, but!
     * @param responseCode
     * @param fileRef
     * @param versionRef
     * @return headers
     */
    responseHeaders (responseCode, fileRef, versionRef) {
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

    /**
     * Files can be downloaded only by authorized users
     * called right before initiate file download
     * return true to continue
     * return false to abort download
     * @param fileObj
     */
    // downloadCallback (fileObj: FileObj) {
    //     Log.debug("FileUpload downloadCallback", fileObj);
    //     Log.debug(this.userId);
    //     return !!(this.userId);
    // },

    /**
     * Files are served only to authorized users (protects download) token in get query is required
     * return true to continue
     * return false to abort download
     * @param fileObj
     */
    protected (fileObj: FileObj) {

        let telegram: any = {};
        let auth = false;

        if (! this.userId) {
            if(!this.request.query && !this.request.query.token) {
                return false;
            }

            let verifyOptions = {
                subject: "download",
                expiresIn: '2h',
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

            auth = ( telegram.sub === 'download' && !!user );

            Log.debug('token auth userId:', user.userId)

        } else {
            auth = !!this.userId;

            Log.debug('token internal auth userId:', this.userId)
        }

        // let session = this.request.cookies.x_mtok;
        // let userId  = (Meteor.server.sessions[session] && Meteor.server.sessions[session].userId) ? Meteor.server.sessions[session].userId : null;
        // Log.debug(this.request.cookies);
        // Log.debug(this.response);
        return auth;
    },

    /**
     * Files can be uploaded only by authorized users, token in meta authenticates that
     * Callback, triggered right before upload is started on client and right after receiving a chunk on server
     * return true to continue
     * return false or {String} to abort upload
     * @param fileData
     */
    onBeforeUpload (fileData: FileData|any) {

        if (!fileData || !fileData.meta || !fileData.meta.token) {
            Log.error("No token provided!");
            throw new Meteor.Error(500, "No token provided!");
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
            Log.error(err);
            throw new Meteor.Error(500, err);
        }

        if (this.userId !== telegram.userId) {
            Log.error(`Wrong user! ${this.userId}, ${telegram.userId}`);
            throw new Meteor.Error(404, "Wrong user!");
        }

        if (fileData._id !== telegram.fileId) {
            Log.error(`Wrong fileId! ${fileData._id}, ${telegram.fileId}`);
            throw new Meteor.Error(404, "Wrong fileId!");
        }

        this.file.meta = {
            ...this.file.meta,
            projectId: telegram.projectId,
            inputId: telegram.inputId,
            draftId: telegram.draftId,
            sampleId: telegram.sampleId
        };
        return !!(this.userId);
    },

    storagePath (fileObj): string {
        let toSavePath:string = `${Meteor.settings['systemRoot']}/http_upload/`.replace(/\/+/g,'/');
        // if(fileObj && fileObj.meta && fileObj.meta.storagePath){
        //     toSavePath = [toSavePath, fileObj.meta.storagePath].join('/').replace(/\/+/g,'/');
        // }
        return toSavePath;
    },

    /**
     * When upload is done call server's procedure and cleanup local's meta
     * @param fileObj
     */
    onAfterUpload (fileObj: any){
        if (!DDPConnection.connection) {
            return;
        }
        Log.debug("FilesUpload onAfterRemove:", fileObj);

        if (!fileObj.meta && !fileObj.meta.token && !fileObj.meta.userId) {
            throw new Meteor.Error(404, "no token");
        }

        DDPConnection.call('satellite/file/uploaded', {token: fileObj.meta.token, location: `file://${fileObj.path}`})
            .subscribe(() => {
                FileUploadCollection.update({_id: fileObj._id},
                    {
                        $unset: {
                            "meta.token": 1,
                            "meta.iat": 1,
                            "meta.exp": 1,
                            "meta.userId": 1,
                            "meta.fileId": 1
                        },
                        $set: {
                            "meta.synced": Date.now()/1000.0
                        }
                    });
                Log.debug('Updated?');
            });

    } //Alternatively use: addListener('afterUpload', func)

    // namingFunction: function(fileObj:FileObj):string{}, - The Default returns the file's _id entry

});

Meteor.publish('raw_data_files', function ({sampleId, projectId}) {
    Log.debug('publish raw_data_files: ', sampleId, projectId);
    if(sampleId) {
        check(sampleId, String);
        return FilesUpload.find({"meta.sampleId": sampleId}).cursor;
    } else if(projectId) {
        check(projectId, String);
        return FilesUpload.find({"meta.projectId": projectId}).cursor;
    } else {
        return this.ready();
    }
});

Meteor.startup(() => {
    FilesUpload.denyClient(); // Deny insert/update/remove from client
});


Meteor.methods({
    'file/remove' (id: any, token: any) {
        Log.debug('file/remove', id, this.userId);
        if (! this.userId) {
            throw new Meteor.Error(403, "Forbidden!");
        }
        check(id, String);
        check(token, String);

        let verifyOptions = {
            subject: "delete",
            expiresIn: '2h',
            algorithm: ["ES512"]
        };

        try {
            jwt.verify(token, connection.server_public_key, verifyOptions);
        } catch (err) {
            Log.error(err);
            throw new Meteor.Error(500, err);
        }

        let fileObj = FilesUpload.findOne({_id: id});

        if (! fileObj ) {
            throw new Meteor.Error(404, `File with ${id} can not be found!`)
        }

        DDPConnection.call('satellite/file/removed', {id: id, meta: fileObj.meta })
            .subscribe(() => {
                Log.debug('Removed?');
            });

        FilesUpload.remove({_id: id}, (e)=>Log.error(e));
    }
});