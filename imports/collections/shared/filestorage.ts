import { Mongo } from 'meteor/mongo';
const path = require('path');


export var FileStorage: any;

export function getCollectionParams (moduleId: string, collectionNameDefault: string, nullConnectionDefault: boolean){
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

let collectionParams = getCollectionParams (path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf(".")), "file_storage", false);

FileStorage = collectionParams.nullConnection ? new Mongo.Collection(collectionParams.name, {"connection": null}) : new Mongo.Collection(collectionParams.name);


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