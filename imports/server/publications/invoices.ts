import { Meteor } from 'meteor/meteor';

import { Log } from '../modules/logger';
import { Invoices } from '../../collections/shared';


const invoicesPublishFields = {
    fields: {}  // @todo restrict it to something
};

Meteor.publish('invoices/get', function (param) {
    if (this.userId) {
        return Invoices.find(param, invoicesPublishFields);
    } else {
        this.ready();
    }
});

