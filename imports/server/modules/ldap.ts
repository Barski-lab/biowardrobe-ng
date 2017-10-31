import { Log } from './logger';


declare function require(m);
var LdapJS = require('ldapjs');


export class LDAPClient {

    private _connection;
    private _reconnect = true;


    constructor(private _config){
        if(!_config.dn || !_config.password ||!_config.dc) {
            throw Error ("Config DN & Pass are required");
        }
        // this.doConnect(_config);
    }


    private doConnect(config) {
        return new Promise((resolve, reject)=> {
            this._connection = LdapJS.createClient(config);
            this._connection
                .on('error', (a) => {
                    reject (a);
                })
                .on('connect', (a) => {
                    resolve ();
                });
        });
    }


    public auth(email,pass){
        let user;
        return this.doConnect (this._config)
            .then(
                () => {
                    Log.debug("LDAP connected");
                    return this.doBind(this._config.dn, this._config.password);
                }
            )
            .then(
                (res) => {
                    Log.debug("First Bind");
                    return this.doSearch(this._config.dc, email);
                }
            )
            .then(
                (obj:any) => {
                    Log.debug("Found:", obj.dn);
                    user = obj;
                    return this.doBind(obj['dn'], pass);
                }
            )
            .then(
                () => {
                    return Promise.resolve(user);
                }
            );
    }


    public doBind(dn, pass) {
        return new Promise((resolve, reject)=> {
            this._connection.bind(dn, pass, function (err, res) {
                if (!err) {
                    resolve(res);
                } else {
                    reject(err);
                }
            });
        });
    }


    public doSearch(dc, email) {
        return new Promise((resolve, reject)=> {
            this._connection.search(dc, {
                filter: '(mail=' + email + ')',
                scope: 'sub',
                attributes: ['dn','sn','givenName','title', 'displayName']
            }, function (err, res) {
                res.on('searchEntry', function (entry) {
                    resolve(entry.object); //entry.raw, entry.attributes
                });
                res.on('error', function (err) {
                    Log.error('error: ' + err.message);
                    reject(err.message);
                });
                res.on('end', function (result) {
                    Log.debug('status: ' + result);
                    reject(result);
                });
            });
        });
    }
}
