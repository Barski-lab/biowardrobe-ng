import { FileData, FileObj, FilesCollection } from "meteor/ostrio:files";

export var FilesUpload: any;
FilesUpload = new FilesCollection({
    collectionName: 'files_upload',
    allowClientCode: false,        // Don't allow to use remove() method on client
    permissions: 0o0664,
    parentDirPermissions: 0o0775,
    continueUploadTTL: 10800,      //This is Default - 10800 seconds = 3 hours

    // Files can be downloaded only by authorized users
    // called right before initiate file download
    // return true to continue
    // return false to abort download
    downloadCallback: function(fileObj:FileObj){
        return !!(this.userId);
    },

    // Files are served only to authorized users
    // return true to continue
    // return false to abort download
    protected: function(fileObj:FileObj){
        return !!(this.userId);
    },

    // Files can be uploaded only by authorized users
    // Callback, triggered right before upload is started on client and right after receiving a chunk on server
    // return true to continue
    // return false or {String} to abort upload
    onBeforeUpload(file:FileData) {
        return !!(this.userId);
    },

    storagePath: function(fileObj):string{
        let toSavePath:string = Meteor.settings['uploadDirectory'];
        if(fileObj && fileObj.meta && fileObj.meta.storagePath){
            toSavePath += fileObj.meta.storagePath;
        }
        return toSavePath;
    },

    onAfterUpload: function(fileObj:FileObj){}, //Alternatively use: addListener('afterUpload', func)

    onAfterRemove: function(files:FileObj[]){},

    onbeforeunloadMessage: function(){
        return 'Upload in a progress...'
    },
    // namingFunction: function(fileObj:FileObj):string{}, - The Default returns the file's _id entry

});