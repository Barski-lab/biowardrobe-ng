import { Meteor } from 'meteor/meteor';

import { Log } from '../modules/logger';
import { Drafts } from '../../collections/shared';


const draftsPublishFields = {
    fields: {
        formId: 1,
        fields: 1
    }
};

Meteor.publish('drafts', function () {
    Log.debug('drafts', this.userId);
    if (this.userId) {
        return Drafts.find({userId: this.userId} , draftsPublishFields);
    } else {
        this.ready();
    }
});

// Maybe we don't need this?
Meteor.startup(function () {
    Drafts._ensureIndex({ "userId": 1});
});

