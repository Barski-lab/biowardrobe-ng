import { Mongo } from 'meteor/mongo';
const path = require('path');


export var FileStorage: any;

export function getCollectionParams (moduleId: string, collectionNameDefault: string, nullConnectionDefault: boolean, settings: any){
    if (settings
        && settings.remotes
        && settings.remotes[moduleId]
        && settings.remotes[moduleId].collection
        && settings.remotes[moduleId].collection.name != undefined
        && settings.remotes[moduleId].collection.nullConnection != undefined){
        return {"name": settings.remotes[moduleId].collection.name, "nullConnection": settings.remotes[moduleId].collection.nullConnection}
    } else {
        return {"name": collectionNameDefault, "nullConnection": nullConnectionDefault}
    }
}

let collectionParams = getCollectionParams (path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf(".")),
                                            "file_storage",
                                            false,
                                            Meteor.settings);

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