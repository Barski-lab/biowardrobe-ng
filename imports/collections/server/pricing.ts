import { Mongo } from 'meteor/mongo';

export const Pricing: any = new Mongo.Collection('pricing');

Pricing.deny({
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