import { DDP } from 'meteor/ddp';
import { Mongo } from 'meteor/mongo';

import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { bindCallback } from 'rxjs/observable/bindCallback';
import { bindNodeCallback } from 'rxjs/observable/bindNodeCallback';
import { fromEvent } from 'rxjs/observable/fromEvent';
import { fromEventPattern } from 'rxjs/observable/fromEventPattern';
import { switchMap, combineAll } from 'rxjs/operators';
import { merge } from 'rxjs/observable/merge';
import { combineLatest } from 'rxjs/observable/combineLatest';

import { CWLCollection } from '../../collections/shared'

import { Log } from './logger';


export class DDPConnection {
    private static DDPConnection: DDP.DDPStatic = null;
    private static _hooks = {};
    private static _messages = {active: [], backup : []};

    private _satelite_ch;

    private satellitesubscription;

    private static chan_id;

    constructor() {
        if(Meteor.settings['rc_server']) {
            this._do_connect();
        }
    }

    public static call<T>(name: string, ...args: any[]): Observable<T> {
        const lastParam = args[args.length - 1];

        if (isMeteorCallbacks(lastParam)) {
            throw Error('MeteorObservable.call');
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
                    return combineLatest(this._draftSubs(), this._cwlSubs())
                })
            )
            .subscribe((c) => {
                Log.debug("Start subscriptions?", c);
            });
    }

    private onReconnect<T>(): Observable<T> {
        return fromEventPattern(DDP['onReconnect'],() => {});
    }

    private _draftSubs(): any {
        return DDPConnection.subscribeAutorun('satellite/drafts',() => {
            let drafts = new Mongo.Collection('platform_drafts', {connection: DDPConnection.DDPConnection,  _suppressSameNameError: true });
            const handler = drafts.find().observeChanges({
                added(id, fields) {
                    Log.info("Drafts/added:", id, _.keys(fields));
                },
                changed(id, fields) {
                    Log.info("Drafts/changed:", id, _.keys(fields));
                },
                removed(id) {
                    Log.info("Drafts/removed:", id);
                }
            });
            return drafts.find().fetch();
        });
    }

    private _cwlSubs(): any {
        return DDPConnection.subscribeAutorun('satellite/cwls',() => {
            let cwls = new Mongo.Collection('CWL', { connection: DDPConnection.DDPConnection,  _suppressSameNameError: true });
            const handler = cwls.find().observeChanges({
                added(id, fields) {
                    Log.info("CWL/added:", id, _.keys(fields));
                    fields['_id'] = id;
                    CWLCollection.insert(fields);
                },
                changed(id, fields) {
                    Log.info("CWL/changed:", id, _.keys(fields));
                    CWLCollection.update({_id: id}, fields);
                },
                removed(id) {
                    Log.info("CWL/removed:", id);
                }
            });
            return handler;
        });
    }

    public static addMessage (newMsg){
        Log.debug('addMessage', newMsg);
        // DDPConnection._messages.active.push (newMsg);
        // DDPConnection._messages.backup.push (newMsg);
    }

    public static subscribeAutorun<T>(name: string, ...args: any[]): Observable<T> {
        let lastParam = args[args.length - 1];

        if (!_.isFunction(lastParam)) {
            console.log('last param has to be a function');
            return;
        }
        let _args = args.slice(0, args.length - 1);


        let autoHandler = null;
        let subHandler = null;
        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            // Execute subscribe lazily.
            if (subHandler === null) {
                subHandler = DDPConnection.DDPConnection.subscribe(name, ..._args.concat([{
                    onError: (error: Meteor.Error) => {
                        observer.error(error);
                    },
                    onReady: () => {
                        // autoHandler = Tracker.autorun((computation: Tracker.Computation) => {
                            let autoHandler = lastParam(subHandler);
                            observer.next(autoHandler)
                            // Tracker.nonreactive(() => );
                            // observer.next(lastParam(computation));
                        // });
                    },
                    onStop: () => {
                        if (autoHandler && autoHandler.stop) {
                            Log.debug('hendler, has a stop!')
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

    public get connection(){
        return DDPConnection.DDPConnection;
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

