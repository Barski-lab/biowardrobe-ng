import { Mongo } from 'meteor/mongo';

export const Samples = new Mongo.Collection('samples');

Samples.deny({
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