import { Meteor } from 'meteor/meteor';

import { Log } from '../modules/logger';
import { Samples } from '../../collections/shared';


const samplesPublishFields = {
    fields: {
        date: 1,
        cwl: 1
    }
};

Meteor.publish('samples/get', function (param) {
    if (this.userId) {
        //TODO: check rights, if user has permissions for this sample
        return Samples.find(param, samplesPublishFields);
    } else {
        this.ready();
    }
});

