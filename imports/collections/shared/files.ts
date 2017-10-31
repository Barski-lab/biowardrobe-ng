import {FileData, FileObj, FilesCollection} from "meteor/ostrio:files";


export var Files: any;
Files = new FilesCollection({
    //###Meta Data
    collectionName: 'files_upload',
    //###Security Settings
    allowClientCode:false,
    downloadCallback: function(fileObj:FileObj){
        return true; //Make access authentication code here
        //@NOTE: If this method returns false, and have access to the record, you will still have access to the
        //record, you just can't download the file and will get a 404 for the cdn link.
    },
    permissions: 0o0664, //Default - See http://permissions-calculator.org/decode/0644/ for reference
    parentDirPermissions: 0o0775, //Default as well.
    protected: function(fileObj:FileObj){return true;},//This does the same as download callback, but instead gives a 401 error, preventing any modificiation of the file.
    //###File Parsing and Upload Configuration
    onBeforeUpload(file:FileData) {
        if (this.userId) return true;
        return 'Not enough rights to upload a file!';
    },
    storagePath: function(fileObj):string{
        let toSavePath:string = Meteor.settings['uploadHome'];
        if(fileObj && fileObj.meta && fileObj.meta.storagePath){
            toSavePath += fileObj.meta.storagePath;
        }
        return toSavePath;
    },
    onAfterUpload: function(fileObj:FileObj){}, //Alternatively use: addListener('afterUpload', func)
    onAfterRemove: function(files:FileObj[]){},
    onbeforeunloadMessage: function(){return 'Upload in a progress... Do you want to abort?'},
    // namingFunction: function(fileObj:FileObj):string{}, - The Default returns the file's _id entry
    //###Speed Settings
    continueUploadTTL: 10800, //This is Default - 10800 seconds = 3 hours
    throttle:false, //Default - Note, giving a number will adjust download speed, NOT upload speed.
    //###Other
    debug: false //Will give extra methods when true
});

// if(Meteor.isServer){
//     // Files.remove({},err=>{throw err;});
//     Meteor.publish("collection.contents",()=>{return Files.find().cursor;})
// }
// if(Meteor.isClient){
//     Meteor.subscribe("collection.contents");
// }