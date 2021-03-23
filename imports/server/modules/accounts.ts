import { Accounts } from 'meteor/accounts-base';
import { LDAPClient } from './ldap';
import { ReplaySubject } from 'rxjs';
import undefined = Match.undefined;
import { Log } from './logger';


export const passMonitor$:ReplaySubject<any> = new ReplaySubject<any>(null);


Accounts['registerLoginHandler']("biowardrobeng", function (request) {

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
    let result:any = {success:false};

    if(Meteor.settings['ldap']
        && Meteor.settings['ldap']['url']
        && Meteor.settings['ldap']['url'].length>0
        && domain == Meteor.settings['oauth2server']['domain']
    ) {

        let _ldap:any = new LDAPClient(Meteor.settings['ldap']);

        result = Meteor.wrapAsync(function(x) {
            _ldap.auth(_email, _pass).then((m)=>{
                const nm =  {
                    "success":     true,
                    "firstName":   m.givenName,
                    "lastName":    m.sn,
                    "occupation":  m.title,
                    "displayName": m.displayName,
                    "ldapDN":      m.dn,
                    "login":       m.dn.slice(m.dn.indexOf('CN=')+3, m.dn.indexOf(',')),
                    ...update
                };
                x(null,nm);
            },(e)=>{
                x(null, {"success":false});
            });
        })();

        Log.debug('BioWardrobe-NG login attempt!!!:', result);

        if(result.success == false && domain == Meteor.settings['oauth2server']['domain']) {
            Log.debug('BioWardrobe-NG login unauthorized');
            throw new Meteor.Error(403, "LDAP User not found");
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
        return {userId: user._id}
    }

    if(!user && !login) {
        throw new Meteor.Error(403, "User not found");
    }
    // equal to user && !login
    if (!user.services || !user.services.password ||
        !user.services.password.bcrypt)
        throw new Meteor.Error(403, "User has no password set");

    return Accounts['_checkPassword'](user, _pass);
}

Accounts.onLogin(function (login) {
    let {user,methodArguments, ...other} = login;
    Log.debug('onLogin:', login.user._id, other);
    let ou = {};
    ou['heartbeat']=ou['profile.lastLogin'] = new Date();

    Meteor.users.update({_id: login.user._id }, { $set: ou });
});

Meteor.startup(() => {
    if(Meteor.settings.email && Meteor.settings.email.url) {
        process.env.MAIL_URL = Meteor.settings.email.url;
    }
});
