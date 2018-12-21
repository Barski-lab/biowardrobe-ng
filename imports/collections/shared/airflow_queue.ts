import { Mongo } from 'meteor/mongo';

export const airflowQueueCollection = new Mongo.Collection('airflow_queue');

airflowQueueCollection.deny({
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