import { Meteor } from 'meteor/meteor';
import '../imports/server';

Meteor.startup(() => {
    if(Meteor.settings['extra_users'].length>0) {
        Meteor.settings['extra_users'].forEach( (u)=> {
            let email = u.email.toLowerCase();
            let user = Meteor.users.findOne({"emails.address": email});
            if (!user) {
                Accounts.createUser({
                    email: email,
                    password: u.pass
                });
            } else {
                Accounts.setPassword(user._id, u.pass)
            }
        });
    }

    Throttle.setMethodsAllowed(false);            // Disable client-side methods
    if(Meteor.settings['logLevel'] == "debug") {
        Throttle.setDebugMode(true);              // Show debug messages
    }

});



