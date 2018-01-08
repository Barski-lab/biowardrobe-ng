import { Mongo } from 'meteor/mongo';

export const CWLs = new Mongo.Collection('cwls');

CWLs.deny({
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