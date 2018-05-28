import { Mongo } from 'meteor/mongo';

export const CWLCollection = new Mongo.Collection('CWL');

CWLCollection.deny({
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