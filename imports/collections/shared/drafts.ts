import { Mongo } from 'meteor/mongo';

export const Drafts: any = new Mongo.Collection('drafts');

Drafts.deny({
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