import { Mongo } from 'meteor/mongo';

export const Invoices: any = new Mongo.Collection('invoices');

Invoices.deny({
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