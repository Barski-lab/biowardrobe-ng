import { Meteor } from 'meteor/meteor';
import { Log } from '../modules/logger';


Meteor.methods({

    "users/update": function (clientId, msg) {
        Log.debug('Call users/update', clientId, msg);
    }

});
