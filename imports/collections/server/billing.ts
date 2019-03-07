import { Mongo } from 'meteor/mongo';

export const Billing: any = new Mongo.Collection('billing');

Billing.deny({
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