import { Mongo } from 'meteor/mongo';

export const Requests = new Mongo.Collection('requests');

Requests.deny({
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