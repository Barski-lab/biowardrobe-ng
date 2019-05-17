import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { FileData, FileObj, FilesCollection } from 'meteor/ostrio:files';
import * as jwt from 'jsonwebtoken';

import { Log } from '../../server/modules/logger';
import { connection, DDPConnection } from '../modules/ddpconnection';

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
                audience: connection.satellite_id,
                algorithm: ["ES512"]
            };

            try {
                telegram = jwt.verify(this.request.query.token, connection.server_public_key, verifyOptions);
            } catch (err) {
                Log.error("raw_data_files: token error: ", err);
                throw new Meteor.Error(500, err);
            }

            let selector = {};

            // if (telegram.accessToken) {
            //     selector = { accessToken: telegram.accessToken }
            // } else {
            //     selector = { userId: telegram.userId }
            // }
            // const user = AccessTokens.findOne(selector);

            // auth = ( telegram.sub === 'download' );
            auth = true;

            Log.debug('[raw_data_files] token auth userId:', telegram.userId)

        } else {
            auth = !!this.userId;

            Log.debug('[raw_data_files] token internal auth userId:', this.userId)
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
            Log.error("[raw_data_files/onBeforeUpload] No token provided!");
            throw new Meteor.Error(500, "No token provided!");
        }

        check(fileData.meta.token, String );

        let verifyOptions = {
            subject: "upload",
            audience: connection.satellite_id,
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

        // if (this.userId !== telegram.userId) {
        //     Log.error(`Wrong user! ${this.userId}, ${telegram.userId}`);
        //     throw new Meteor.Error(404, "Wrong user!");
        // }

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
        return true;
    },

    storagePath (fileObj): string {
        let prjDirName = '';

        if(fileObj && fileObj.meta && fileObj.meta.projectId) {
            prjDirName = fileObj.meta.projectId;
        }

        let toSavePath:string = `${Meteor.settings['systemRoot']}/${prjDirName}/http_upload/`.replace(/\/+/g,'/');
        Log.debug("[raw_data_files] toSavePath", toSavePath);
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
        Log.debug("FilesUpload onAfterUpload:", fileObj);

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

Meteor.publish('raw_data_files', function ({sampleId, projectId, fileIdes, token}) {
    Log.debug('[raw_data_files]: publish: ', sampleId, projectId, fileIdes, token);

    check(token, String);


    let verifyOptions = {
        audience: connection.satellite_id,
        subject: "download",
        algorithm: ["ES512"]
    };

    let publicKEY = connection.server_public_key;
    let telegram: any = {};

    try {
        telegram = jwt.verify(token, publicKEY, verifyOptions);
    } catch (err) {
        Log.error(err);
        throw new Meteor.Error(500, err);
    }

    if(fileIdes && Array.isArray(fileIdes)) {

        check(fileIdes, [String]);
        return FilesUpload.find({"_id": {$in: fileIdes}}).cursor;

    } else if(sampleId) {

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

        check(id, String);
        check(token, String);

        Log.debug('[raw_data_files]: file/remove:', token, this.userId);

        const verifyOptions = {
            audience: connection.satellite_id,
            subject: "delete",
            algorithm: ["ES512"]
        };

        let telegram: any = {};

        try {
            telegram = jwt.verify(token, connection.server_public_key, verifyOptions);
        } catch (err) {
            Log.error("[raw_data_files]: file/remove error:", err);
            throw new Meteor.Error(500, err);
        }


        const fileObj = FilesUpload.findOne({_id: telegram.fileId});

        if (! fileObj ) {
            throw new Meteor.Error(404, `File with ${telegram.fileId} can not be found!`)
        }

        DDPConnection.call('satellite/file/removed', {id: telegram.fileId, meta: fileObj.meta })
            .subscribe(() => {
                Log.debug('Removed?');
            });

        FilesUpload.remove({_id: telegram.fileId}, (e) => Log.error(e));
    }
});