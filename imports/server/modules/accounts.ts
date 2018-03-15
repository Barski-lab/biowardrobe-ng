import { Accounts } from 'meteor/accounts-base';
import { LDAPClient } from './ldap';
import { ReplaySubject } from 'rxjs';
import undefined = Match.undefined;
import { Log } from './logger';


export const passMonitor$:ReplaySubject<any> = new ReplaySubject<any>(null);


Accounts.registerLoginHandler("biowardrobeng", function (request) {

    if (request.biowardrobeng !== true ) {
        return undefined;
    }

    check(request,{
        email: String,
        pass: String,
        biowardrobeng: Boolean
    });

    const _pass = request.pass;
    const _email = request.email.toLowerCase();

    Log.debug('BioWardrobe-NG login attempt email:', _email);

    const domain = _email.substring(_email.lastIndexOf("@") +1);

    if(!domain) return { error: 'Is it email?' };


    let update = {};
    let nm, result:any = {success:false};

    if(Meteor.settings['ldap'] && Meteor.settings['ldap']['url'].length>0 && domain == Meteor.settings['oauth2server']['domain']) {
        let _ldap:any = new LDAPClient(Meteor.settings['ldap']);
        let ldap_response = _ldap.auth(_email, _pass);

        result = Meteor.wrapAsync(function(x){
            ldap_response.then((m)=>{
                nm =  _.defaults(update, {
                    "success":     true,
                    "firstName":   m.givenName,
                    "lastName":    m.sn,
                    "occupation":  m.title,
                    "displayName": m.displayName,
                    "ldapDN":      m.dn,
                    "login":       m.dn.slice(m.dn.indexOf('CN=')+3, m.dn.indexOf(','))
                });
                x(null,nm);
            },(e)=>{
                x(null,{"success":false});
            });
        })();

        Log.debug('BioWardrobe-NG login attempt!!!:', result);

        if(result.success == false && domain == Meteor.settings['oauth2server']['domain']) {
            Log.debug('BioWardrobe-NG login unauthorized');
            // throw new Meteor.Error(403, "LDAP User not found");
        }

        if(result.success) {
            return findOrCreateUser(_email, _pass, result.login);
        }
    }
    return findOrCreateUser(_email, _pass, );

});
/**
 * If login is provided, it means that user is already authorized by LDAP
 * Then we either return userdId by his email or create new user and then
 * return his userId
 *
 * If login is not provided - we are trying to authorize some user which
 * doesn't have any record in LDAP server.
 * In this case we cannot create any new users. So if we couldn't find him
 * by email - return failed authorization.
 * If we found user, we should first check if this user has password, and then
 * check if his password is valid (call _checkPassword)
 * @param _email {string} - an user email address
 * @param _pass {string } - user pass
 * @param login {string } - optional
 * @returns {any} - throw an error on error or returns the user object
 */
export function findOrCreateUser( _email, _pass, login?) {
    _email = _email.toLowerCase();

    let user:any = Accounts.findUserByEmail(_email); //Meteor.users.findOne({"emails.address": _email});

    if (!user && login) {
        Accounts.createUser({
            email: _email
        });
        user = Meteor.users.findOne({"emails.address": _email});
    }
    if (user && login) {
        passMonitor$.next({
            email:_email,
            login:login,
            pass:_pass,
            userId: user._id
        });
        return {
            userId: user._id
        }
    }

    if(!user && !login) {
        throw new Meteor.Error(403, "User not found");
    }
    // equal to user && !login
    if (!user.services || !user.services.password ||
        !user.services.password.bcrypt)
        throw new Meteor.Error(403, "User has no password set");

    return Accounts._checkPassword(user, _pass);
}

/**
 * Read array of extra_users (array of emails) from Meteor.settings and if current email
 * is not assigned with any of the existent user, create the new user with current email
 * and empty password. User cannot login until he sets his password by following the link
 * sent to his email by sendEnrollmentEmail function
 */
export function setExtraUsers (){
    if(Meteor.settings['extra_users'] && Meteor.settings['extra_users'].length > 0) {
        Meteor.settings['extra_users'].forEach( (email)=> {
            if (!Meteor.users.findOne({"emails.address": email.toLowerCase()})) {
                let userId = Accounts.createUser({
                    email: email.toLowerCase(),
                });
                Accounts.sendEnrollmentEmail(userId);
            }
        });
    }
}

Accounts.onLogin(function (login) {
    Log.debug('onLogin:',login.user._id,_.omit(login,["user","methodArguments"]));
    let ou = {};
    ou['heartbeat']=ou['profile.lastLogin'] = new Date();

    Meteor.users.update({_id: login.user._id }, { $set: ou });
});

export function configAccounts(){
    Accounts.emailTemplates.siteName = Meteor.settings['name'];
    Accounts.emailTemplates.from = Meteor.settings.email.from;

    Accounts['urls'] = _.extend(Accounts['urls'],{
        resetPassword: function (token) {
            return Meteor.settings.base_url+"reset/" + token;
        },
        enrollAccount: function (token) {
            return Meteor.settings.base_url+"enroll/" + token;
        }
    });

    Accounts.config(_.defaults({
            sendVerificationEmail: true,       // TODO maybe we don't need it, if we use only enrollment email
            forbidClientAccountCreation: true,
            loginExpirationInDays: 7
        },
        Meteor.settings['accounts']));
}