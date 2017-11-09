import { Meteor } from 'meteor/meteor';
import { chai } from 'meteor/practicalmeteor:chai'; // Assertion library
import { resetDatabase } from 'meteor/xolvio:cleaner';

import { setExtraUsers } from '../modules/accounts';
import './accounts';


describe('server', function() {
    describe('methods', function() {
        describe('accounts', function() {
            describe('#forgotPassword()', function() {
                before(function() {
                    resetDatabase();
                    Meteor.settings  = _.extend(Meteor.settings, {
                        "extra_users":["user-1@domain.com", "user-2@your-domain.com"]
                    });
                    setExtraUsers();
                });

                it('Return error if method was called with wrong argument type', function (done) {
                    let options = {email: 10};
                    Meteor.call ("forgotPassword", options, (err, res) => {
                        err? done() : done("random_not_empty_argument");
                    });
                });

                it('Return error if method was called with email not allowed to reset password', function (done) {
                    let options = {email: "user-not-allowed@domain.com"};
                    Meteor.call ("forgotPassword", options, (err, res) => {
                        err? done() : done("random_not_empty_argument");
                    });
                });

                it("Return error if email exists in extra_users, but user with this email is absent", function (done) {
                    Meteor.settings.extra_users.push("user-doesnt-exist@your-domain.com\"");
                    let options = {email: "user-doesnt-exist@domain.com"};
                    Meteor.call ("forgotPassword", options, (err, res) => {
                        err? done() : done("random_not_empty_argument");
                    });
                });

                it("Return success if method is called with correct arguments for existent user", function (done) {
                    let options = {email: "user-1@domain.com"};
                    Meteor.call ("forgotPassword", options, (err, res) => {
                        err? done(err) : done();
                    });
                });

                after(function() {
                    delete Meteor.settings.extra_users;
                    resetDatabase();
                });
            });
        });
    });
});