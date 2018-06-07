import { Mongo } from 'meteor/mongo';

export const Projects = new Mongo.Collection('projects');

Projects.deny({
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