import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { Log } from '../modules/logger';
import { CWLCollection } from '../../collections/shared';

const CWLPublishFields = {
    fields: {}
};


// TODO: add check, define wich parameters should define the selector, which fields to publish
Meteor.publish('cwl/list', function (params = {}) {
    Log.debug('cwl/list',this.userId, params);
    if (this.userId) {
        return CWLCollection.find(params, CWLPublishFields);
    } else {
        this.ready();
    }
});

