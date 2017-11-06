import { Meteor } from 'meteor/meteor';
import '../imports/server';

Meteor.startup(() => {
    if(Meteor.settings['extra_users'].length>0) {
        Meteor.settings['extra_users'].forEach( (email)=> {
            let email = email.toLowerCase();
            if (!Meteor.users.findOne({"emails.address": email})) {
                Accounts.createUser({
                    email: email,
                    password: Random.secret()
                });
            }
        });
    }

    Throttle.setMethodsAllowed(false);            // Disable client-side methods
    if(Meteor.settings['logLevel'] == "debug") {
        Throttle.setDebugMode(true);              // Show debug messages
    }

});



