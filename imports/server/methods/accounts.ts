import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Log } from '../modules/logger';


Meteor.default_server.method_handlers['forgotPassword'] = function (options) {

    check(options, {email: String});

    if (!Meteor.settings['extra_users'] || !Meteor.settings['extra_users'].includes (options.email)){
        throw new Meteor.Error(401, 'User is not allowed to reset password');
    }

    var user = Accounts.findUserByEmail(options.email);
    if (!user) {
        throw new Meteor.Error(403, 'User not found');
    }

    const emails = _.pluck(user.emails || [], 'address');
    const caseSensitiveEmail = _.find(emails, email => {
        return email.toLowerCase() === options.email.toLowerCase();
    });

    Accounts.sendResetPasswordEmail(user._id, caseSensitiveEmail);
};