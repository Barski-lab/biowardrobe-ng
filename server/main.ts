import { Meteor } from 'meteor/meteor';
import '../imports/server';
import { setExtraUsers, configAccounts } from '../imports/server/modules/accounts'

Meteor.startup(() => {
    Throttle.setMethodsAllowed(false);            // Disable client-side methods
    if(Meteor.settings['logLevel'] == "debug") {
        Throttle.setDebugMode(true);              // Show debug messages
    }

    setExtraUsers();
    configAccounts();

});



