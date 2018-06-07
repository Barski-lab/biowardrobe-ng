import { Mongo } from 'meteor/mongo';

export const Labs = new Mongo.Collection('laboratories');

Labs.deny({
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