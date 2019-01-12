import { Mongo } from 'meteor/mongo';

/**
 * Collection to store airflow jobs before trigger, for a cleanup
 */
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