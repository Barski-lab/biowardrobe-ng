import { DDP } from 'meteor/ddp';
import { Mongo } from 'meteor/mongo';

import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { bindCallback } from 'rxjs/observable/bindCallback';
import { bindNodeCallback } from 'rxjs/observable/bindNodeCallback';
import { fromEvent } from 'rxjs/observable/fromEvent';
import { fromEventPattern } from 'rxjs/observable/fromEventPattern';
import { switchMap, combineAll } from 'rxjs/operators';
import { Subject } from 'rxjs/Subject';
import { merge } from 'rxjs/observable/merge';
import { combineLatest } from 'rxjs/observable/combineLatest';

import { CWLCollection, Drafts, Labs, Projects } from '../../collections/shared'

import { Log } from './logger';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

export class DDPConnection {
    private static DDPConnection: DDP.DDPStatic = null;
    private static _hooks = {};
    private static _messages = {active: [], backup : []};

    public static sync$ = new BehaviorSubject(null);

    private _satelite_ch;

    private satellitesubscription;

    private static chan_id;

    constructor() {
        if(Meteor.settings['rc_server']) {
            this._do_connect();
        }
    }

    private _do_connect() {
        if(!DDPConnection.DDPConnection) {
            DDPConnection.DDPConnection = DDP.connect(Meteor.settings.rc_server);
            Log.debug ("Setting DDP connection to", Meteor.settings.rc_server);
        }

        let x = this.onReconnect()
            .pipe(
                switchMap((v) => {
                    Log.info("Reconnecting");
                    return DDPConnection.call('satellite/auth', Meteor.settings.rc_server_token);
                }),
                switchMap((v) => {
                    return combineLatest(this._usersSubs(), this._cwlSubs())
                }),
                switchMap((v) => {
                    return combineLatest(this._labsSubs(), this._projectsSubs())
                })
            )
            .subscribe(DDPConnection.sync$);
    }

    private onReconnect<T>(): Observable<T> {
        return fromEventPattern(DDP['onReconnect'],() => {});
    }

    private _usersSubs(): any {
        return this._observeChanges('satellite/users', 'users', null, {
            // TODO: Has to organize it into a stream, somehow.
            added(id, fields) {

                const _email = fields.emails[0].address.toLowerCase();
                const _user = Meteor.users.findOne({ "emails.address": new RegExp(`${_email}`, 'i') });

                if(! _user) {
                    Log.debug(`satellite/users/added:`, id, fields);
                    fields["_id"] = id;
                    Meteor.users.insert(fields);
                } else
                if(_user && _user._id != id ) {
                    Log.info('Replace old user:', id, _user._id);
                    _user['old_id'] = _user['old_id'] || [];
                    _user['old_id'].push(_user._id);
                    _user['_id'] = id;
                    _user['roles'] = fields['roles'];
                    _user['profile'] = fields['profile'];
                    _user['emails'] = fields['emails'];
                    Meteor.users.insert(_user);
                    Meteor.users.remove({_id: _user._id});
                }
            }
        });
    }

    private _cwlSubs(): any {
        return this._observeChanges('satellite/cwls', 'CWL', CWLCollection);
    }

    private _labsSubs(): any {
        return this._observeChanges('satellite/labs', 'labs', Labs);
    }

    private _projectsSubs(): any {
        return this._observeChanges('satellite/projects', 'projects', Projects);
    }

    private _observeChanges(_subscription, _remote_collection_name, _collection?, _callbacks?) {
        _callbacks = _callbacks || {
            added(id, fields) {
                Log.debug(`${_remote_collection_name}/added:`, id, _.keys(fields));
                if(_collection) {
                    _collection.update({_id: id}, fields, {upsert: true});
                }
            },
            changed(id, fields) {
                Log.debug(`${_remote_collection_name}/changed:`, id, _.keys(fields));
                if(_collection) {
                    _collection.update({_id: id}, fields, {upsert: true});
                }
            },
            removed(id) {
                Log.debug(`${_remote_collection_name}/removed:`, id);
            }
        };
        return DDPConnection.subscribeAutorun(_subscription,() => {
            let _c_coll = new Mongo.Collection(_remote_collection_name, rc_connection);
            return _c_coll.find().observeChanges(_callbacks);
        });
    }

    /**
     * Call a method on remote server
     * @param {string} name
     * @param args
     * @returns {Observable<T>}
     */
    public static call<T>(name: string, ...args: any[]): Observable<T> {
        const lastParam = args[args.length - 1];

        if (isMeteorCallbacks(lastParam)) {
            throw Error('MeteorObservable.call, callback will be provided');
        }

        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            DDPConnection.DDPConnection.call(name, ...args.concat([
                (error: Meteor.Error, result: T) => {
                    error ? observer.error(error) : observer.next(result);
                    observer.complete();
                }
            ]));
        });
    }

    public static apply<T>(name: string, args: EJSONable[], options?: {
        wait ?: boolean;
        onResultReceived ?: Function;
    }): Observable<T> {

        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            DDPConnection.DDPConnection.apply(name, args, options,
                (error: Meteor.Error, result: T) => {
                    error ? observer.error(error) : observer.next(result);
                    observer.complete();
                });
        });
    }

    public static subscribeAutorun<T>(name: string, ...args: any[]): Observable<T> {
        let lastParam = args[args.length - 1];

        if (!_.isFunction(lastParam)) {
            Log.debug('last param has to be a function');
            return;
        }
        let _args = args.slice(0, args.length - 1);


        let autoHandler = null;
        let subHandler = null;
        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            if (subHandler === null) {
                subHandler = DDPConnection.DDPConnection.subscribe(name, ..._args.concat([{
                    onError: (error: Meteor.Error) => {
                        observer.error(error);
                    },
                    onReady: () => {
                        autoHandler = lastParam(subHandler);
                        observer.next(autoHandler)
                    },
                    onStop: () => {
                        if (autoHandler && autoHandler['stop']) {
                            Log.debug('observeChanges stop subscription!', autoHandler.collection.name);
                            autoHandler.stop();
                        }
                    }
                }
                ]));
            }
            return () => {
                subHandler.stop();
            };
        });
    }

    public static addMessage (newMsg){
        Log.debug('addMessage', newMsg);
        // DDPConnection._messages.active.push (newMsg);
        // DDPConnection._messages.backup.push (newMsg);
    }


    /*
    private _do_init() {
        if(this.satellitesubscription)
            this.satellitesubscription.stop();

        // this.satellitesubscription = DDPConnection.DDPConnection.subscribe("satellite", Meteor.settings.rc_server_token, {
        //     onStop: (a) => {
        //         Log.info("Subscribe stop:", a);
        //         DDPConnection.chan_id = null;
        //         // DDPConnection.DDPConnection.reconnect();
        //     },
        //     onReady: () => {
        //     }
        // });
    }


    private sendMessages () {
        if (DDPConnection.chan_id && DDPConnection._messages.active.length > 0 ){
            while (DDPConnection._messages.active.length) {
                let msg = DDPConnection._messages.active.pop();
                DDPConnection.DDPConnection.call('add/remotemodule', Meteor.settings['rc_server_token'], msg,
                    (err, res) => {
                        if (err) {
                            // Log.error("Can't send message \n", msg, err);
                            DDPConnection._messages.active.push (msg);
                        }
                    }
                );
            }
        }
    }

    public static addMessage (newMsg){
        DDPConnection._messages.active.push (newMsg);
        DDPConnection._messages.backup.push (newMsg);
    }

    private restoreBackupMessages (){
        Log.debug("Restore satellite messages from backup to resend to server after reconnect");
        DDPConnection._messages.active = [];
        DDPConnection._messages.backup.forEach(backUpMsg => {
            DDPConnection._messages.active.push(backUpMsg)
        });
    }


    private _check_recieve(a, type){ //type: added, changed...

        if( a.subscribed && a._id ) {
            DDPConnection.chan_id = a._id;
            Log.debug("New satellite is connected:", a);
            return;
        }

        Log.info("Recieve:\n", type, a);

        var request = a.request;

        if( DDPConnection.chan_id && a._id && request.files ) { //files
            Log.debug("Files:\n", request);
            try {
                this.processFiles (request, a);
            } catch(e){}
        }
    }
    */
    // /**
    //  * @Deprecated
    //  * @param request
    //  * @param a
    //  */
    // public processFiles (request, a){
    //     Log.debug("processFiles is called");
    //     var targetModule = _.find (DDPConnection._hooks["files"], remoteModule => {return remoteModule.moduleId == request.moduleId});
    //     if (targetModule == null){
    //         return;
    //     }
    //     Log.debug("processFiles target module", targetModule);
    //     var message = targetModule.moduleFunction(request);
    //     if(DDPConnection.chan_id && message) {
    //         message.then((m)=> {
    //                 DDPConnection.DDPConnection.call("remote/module/data", a._id, m);
    //                 Log.debug("Success files:\n", a._id, m);
    //             }, (e)=> {
    //                 DDPConnection.DDPConnection.call("remote/module/data", a._id, {"error": e});
    //                 Log.debug("Fail files:\n", a._id, e);
    //             }
    //         )
    //     }
    // }
    //
    //
    // /**
    //  * Check if it works
    //  * @param {{type: String; moduleId: String; func: String; params: any}} request
    //  * @returns {Promise<any>}
    //  */
    // public callModuleFunc (request: {type: String, moduleId: String, func: String, params: any}){
    //     try {
    //         var targetModule = _.find (DDPConnection._hooks[request.type], remoteModule => {return remoteModule.moduleId == request.moduleId});
    //         let promiseFunction = targetModule.moduleFunction(request);
    //     } catch (err){
    //         throw new Meteor.Error("Module or target function is not found", err);
    //     }
    //     return promiseFunction;
    // }
    //
    //
    public static registerHook(n,h){
        if(!DDPConnection._hooks[n])
            DDPConnection._hooks[n]=[];

        // if(typeof h === "function") // Should allow Objects too, because of file
        {
            Log.debug("Register Hook type", n);
            DDPConnection._hooks[n].push(h);
        }
    }

    public static get connection(){
        return DDPConnection.DDPConnection;
    }
}

export const connection = new DDPConnection();
export const rc_connection: any = {connection: DDPConnection.connection,  _suppressSameNameError: true };

////// HELPER FUNCTIONS
export interface CallbacksObject {
    onReady?: Function;
    onError?: Function;
    onStop?: Function;
}

export declare type MeteorCallbacks = ((...args) => any) | CallbacksObject;

export const subscribeEvents = ['onReady', 'onError', 'onStop'];

export function isMeteorCallbacks(callbacks: any): boolean {
    return _.isFunction(callbacks) || isCallbacksObject(callbacks);
}

// Checks if callbacks of {@link CallbacksObject} type.
export function isCallbacksObject(callbacks: any): boolean {
    return callbacks && subscribeEvents.some((event) => {
        return _.isFunction(callbacks[event]);
    });
}

