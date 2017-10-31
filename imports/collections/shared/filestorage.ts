import { Mongo } from 'meteor/mongo';
const path = require('path');

export var FileStorage: any;

let moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf("."));

let collectionNameDefault = "file_storage";
let nullConnectionDefault = false;

try {
    collectionNameDefault = Meteor.settings.remotes[moduleId].collection.name;
    nullConnectionDefault = Meteor.settings.remotes[moduleId].collection.nullConnection;
} catch (err){}

FileStorage = nullConnectionDefault ? new Mongo.Collection(collectionNameDefault, {"connection": null}) : new Mongo.Collection(collectionNameDefault);

FileStorage.deny({
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