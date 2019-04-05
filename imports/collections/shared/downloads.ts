import { Mongo } from 'meteor/mongo';

export const Downloads = new Mongo.Collection('downloads');

Downloads.deny({
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