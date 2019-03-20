/**
 * Class DDPConnection
 * Connects to the server
 * Syncs users, cwl, labs, projects, samples
 */
import { DDP } from 'meteor/ddp';
import { Mongo } from 'meteor/mongo';

import { BehaviorSubject, Observable, Subscriber, Subject } from 'rxjs';
import { switchMap, catchError, filter, shareReplay, merge, share } from 'rxjs/operators';
import { combineLatest } from 'rxjs/observable/combineLatest';
import { fromEventPattern } from 'rxjs/observable/fromEventPattern';
import { of } from 'rxjs/observable/of';

import { CWLCollection, Drafts, Labs, Projects, Samples, Requests } from '../../collections/shared';

import { Log } from './logger';
import {ModuleCollection} from './remotes/postform';

export class DDPConnection {
    private static DDPConnection: DDP.DDPStatic = null;
    private static _hooks = {};
    private public_key: string;
    private common_project_id: string;
    // private static _messages = { active: [], backup: [] };

    private _sync$: BehaviorSubject<any> = new BehaviorSubject<any>(null);
    public get sync$() {
        return this._sync$.pipe(filter(_ => !!_));
        // return this._do_connect();
    }

    private _main_events$: Subject<any> = new Subject<any>();
    public get events$() {
        return this._main_events$; //.pipe(share());
    }

    private _requests$: Subject<any> = new Subject<any>();
    public get requests$() {
        return this._requests$;
    }

    public get server_public_key() {
        return this.public_key;
    }

    public get satellite_common_project_id() {
        return this.common_project_id;
    }

    constructor() {
        this._do_connect();
    }

    private _do_connect() {

        if (!Meteor.settings.rc_server) {
            return;
        }

        if (!DDPConnection.DDPConnection) {
            DDPConnection.DDPConnection = DDP.connect(Meteor.settings.rc_server);
            Log.debug("Setting DDP connection to", Meteor.settings.rc_server);

            // TODO: do not redefine default functions 'subscribe' etc
            // Proxy the public methods of Meteor.connection so they can
            // be called directly on Meteor.
        }

        return this.onReconnect()
            .pipe(
                switchMap((v) => {
                    Log.info("Reconnecting");
                    this.public_key = undefined;
                    return DDPConnection.call('satellite/auth', Meteor.settings.rc_server_token);
                }),
                filter(({ satId, pubkey, common_project_id }) => !!satId),
                switchMap( ({ satId, pubkey, common_project_id }) => {
                    let modules = [];
                    this.public_key = pubkey;
                    this.common_project_id = common_project_id;

                    if(DDPConnection._hooks["files"]) {

                        modules = DDPConnection._hooks["files"].map( h => {
                            return {
                                moduleId: h.info.moduleId,
                                caption: h.info.caption,
                                type: h.info.type,
                                collection: h.info.collection,
                                publication: h.info.publication,
                                protocol: h.info.protocol
                            };
                        })
                    }

                    const abs_url = Meteor.absoluteUrl();
                    const os = require( 'os' );
                    const networkInterfaces = Object['values'](os.networkInterfaces())
                        .reduce( (r, a) => r.concat(a), [])
                        .filter(({family, address}) => {
                            let firstNumber = 1 * address.split('.')[0];
                            return family.toLowerCase().indexOf('v4') >= 0 &&
                                !address.startsWith('127') &&
                                !address.startsWith('169.254') &&
                                !(firstNumber >= 224 && firstNumber <= 239);
                        })
                        .map(({address}) => address);

                    return DDPConnection.call('satellite/info', {
                        "remoteModules": modules,
                        "tech": {
                            localip: networkInterfaces || [],
                            absoluteUrl: abs_url || "",
                            port: Meteor.isProduction ? process.env.PORT : 3030
                        }
                    });
                }),
                merge(
                    this._usersSubs(),
                    this._cwlSubs(),
                    this._labsSubs(),
                    this._projectsSubs(),
                    this._samplesSubs(),
                    this._requestsSubs()
                ),
                catchError((e) => of({ error: true, message: `Reconnect error: ${e}` }))
            ).subscribe(this._sync$);
    }

    private onReconnect<T>(): Observable<T> {
        return fromEventPattern(DDP['onReconnect']);
    }

    /**
     * subscribe to User updates
     * @private
     */
    private _usersSubs(): any {
        return this._observeChanges('satellite/users', 'users', null, {
            // TODO: Has to organize it into a stream, somehow.
            added(id, fields) {

                const _email = fields.emails[0].address.toLowerCase();
                const _user = Meteor.users.findOne({ "emails.address": new RegExp(`${_email}`, 'i') });

                if (!_user) {
                    Log.debug(`satellite/users/added:`, id, fields);
                    fields["_id"] = id;
                    Meteor.users.update({_id: id}, {$set: fields}, {upsert: true});
                } else {
                    if (_user._id != id) {
                        Log.info('Replace old user:', id, _user._id);
                        let old_id = _user._id;
                        _user['old_id'] = _user['old_id'] || [];
                        _user['old_id'].push(_user._id);
                        _user['_id'] = id;
                        _user['roles'] = fields['roles'];
                        _user['profile'] = fields['profile'];
                        // TODO: All emails to add? or just the domain one
                        _user['emails'] = fields['emails'];
                        Meteor.users.remove({ _id: old_id });
                        Meteor.users.update({ _id: id }, { $set: _user }, { upsert: true });
                        let lab: any = Labs.findOne({"owner._id": old_id});
                        let projects: any = Projects.find({ $and: [{"labs._id": lab._id }, {"labs.main": true}]}).map((p:any) => p._id);
                        Labs.remove({"owner._id": old_id});
                    }
                }
                // TODO: temporary solution
                ModuleCollection.update({email: _email}, {$set: {"userId": id}});
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

    private _samplesSubs(): any {
        return this._observeChanges('satellite/samples', 'samples', Samples);
    }

    private _requestsSubs(): any {
        let self = this;
        return this._observeChanges('satellite/requests', 'satellitesRequests', null, {
                added(id, fields) {
                    Log.debug(`satellitesRequests/added:`, id, fields);
                    self._requests$.next({...fields, name: 'requests', event: 'added', _id: id });
                    Requests.update({ _id: id }, { $set: fields }, { upsert: true });
                },
                removed(id) {
                    Log.debug(`satellitesRequests/removed:`, id);
                    Requests.remove({ _id: id });
                }
            }
        );
    }

    /**
     * Observe changes on a collection after subscription
     * @param _subscription - subscription string
     * @param _remote_collection_name - collection name on the other side
     * @param _collection
     * @param _callbacks
     * @private
     */
    private _observeChanges(_subscription, _remote_collection_name, _collection?, _callbacks?) {
        let self = this;
        if (!_callbacks) {
            _callbacks = {
                added(id, fields) {
                    Log.debug(`${_remote_collection_name}/added:`, id, Object.keys(fields));
                    self._main_events$.next({name: _remote_collection_name, event: 'added', id: id});
                    if (_collection) {
                        _collection.update({_id: id}, {$set: fields}, {upsert: true});
                    }
                },
                changed(id, fields) {
                    Log.debug(`${_remote_collection_name}/changed:`, id, Object.keys(fields));
                    self._main_events$.next({name: _remote_collection_name, event: 'changed', id: id});
                    if (_collection) {
                        _collection.update({_id: id}, {$set: fields}, {upsert: true});
                    }
                },
                removed(id) {
                    Log.debug(`${_remote_collection_name}/removed:`, id);
                    self._main_events$.next({name: _remote_collection_name, event: 'removed', id: id});
                }
            };
        }
        return DDPConnection.subscribeAutorun(_subscription, (d) => {
            let _c_coll = new Mongo.Collection(_remote_collection_name, DDPConnection.rc_connection);
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
            throw Error('DDPConnection.call: callback will be provided');
        }

        return Observable.create(Meteor.bindEnvironment( (observer: Subscriber<Meteor.Error | T>) => {
            return DDPConnection.DDPConnection.call(name, ...args.concat([
                (error: Meteor.Error, result: T) => {
                    error ? observer.error(error) : observer.next(result);
                    observer.complete();
                }
            ]));
        }));
    }

    public static apply<T>(name: string, args: EJSONable[], options?: {
        wait?: boolean;
        onResultReceived?: Function;
    }): Observable<T> {

        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            DDPConnection.DDPConnection.apply(name, args, options,
                (error: Meteor.Error, result: T) => {
                    error ? observer.error(error) : observer.next(result);
                    observer.complete();
                });
        });
    }

    /**
     * Subscribe to a remote publication, onReady call last param callback and return the result into observer
     * @param name
     * @param args
     */
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
                        observer.complete();
                    }
                }
                ]));
            }
            return () => {
                subHandler.stop();
            };
        });
    }

    /**
     *
     * @param n - hook ID
     * @param h
     */
    public static registerHook(n, h) {
        if (!DDPConnection._hooks[n])
            DDPConnection._hooks[n] = [];

        // if(typeof h === "function") // Should allow Objects too, because of file
        {
            Log.debug("Register Hook type", n);
            DDPConnection._hooks[n].push(h);
        }
    }

    public static get connection() {
        return DDPConnection.DDPConnection;
    }

    public static get rc_connection() {
        return {connection: DDPConnection.connection, _suppressSameNameError: true};
    }

}

export const connection = new DDPConnection();

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

