import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Log } from '../modules/logger';


Meteor.default_server.method_handlers['forgotPassword'] = function (options) {
    // Redefining method forgotPassword from Accounts.
    // All of the users that login throught LDAP over oauth2, shouldn't have the rights to call
    // forgotPassword so they will not be able to reset their password.

    check(options, {email: String});

    Log.debug('BioWardrobe-NG forgotPassword attempt email:', options.email);

    let domain = options.email.substring(options.email.lastIndexOf("@") +1);
    if(!domain) throw new Meteor.Error(500, "Cannot get the domain name from email");

    if (Meteor.settings['ldap'] &&
        Meteor.settings['ldap']['url'].length>0 &&
        Meteor.settings['oauth2server'] &&
        domain == Meteor.settings['oauth2server']['domain']) {
        throw new Meteor.Error(500, "User is not allowed to reset password");
    }

    let user = Accounts.findUserByEmail(options.email);
    if (!user) {
        throw new Meteor.Error(500, 'User not found');
    }

    const emails = _.pluck(user.emails || [], 'address');
    const caseSensitiveEmail = _.find(emails, email => {
        return email.toLowerCase() === options.email.toLowerCase();
    });

    Accounts.sendResetPasswordEmail(user._id, caseSensitiveEmail);
};