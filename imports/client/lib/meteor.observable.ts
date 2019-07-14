import { DDP } from 'meteor/ddp';
import { Observable, Subscriber } from 'rxjs';


export class MeteorObservable {

    public static subscribeAutorun<T>(name: string, ...args: any[]): Observable<T> {
        let lastParam = args[args.length - 1];

        if (typeof lastParam !== 'function') {
            console.log('last param has to be a function');
            return;
        }
        let _args = args.slice(0, args.length - 1);


        let autoHandler = null;
        let subHandler = null;
        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            // Execute subscribe lazily.
            if (subHandler === null) {
                subHandler = Meteor.subscribe(name, ..._args.concat([{
                    onError: (error: Meteor.Error) => {
                        observer.error(error);
                    },
                    onReady: () => {
                        autoHandler = Tracker.autorun((computation: Tracker.Computation) => {
                            let _r =lastParam(computation);
                            Tracker.nonreactive(()=>observer.next(_r));
                            // observer.next(lastParam(computation));
                        });
                    },
                    onStop: () => {
                        if(autoHandler)
                            autoHandler.stop();
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
     * Invokes a [Meteor Method](https://docs.meteor.com/api/methods.html)
     * defined on the server, passing any number of arguments. This method has
     * the same signature as
     * [Meteor.call](https://docs.meteor.com/api/methods.html#Meteor-call), only
     * without the callbacks:
     *    MeteorObservable.call(name, [...args])
     *
     *
     *  @param {string} name - Name of the method in the Meteor server
     *  @param {any} args - Parameters that will be forwarded to the method.
     *   after the func call to initiate change detection.
     *  @returns {Observable<T>} - RxJS Observable, which completes when the
     *  server returns a response.
     *
     *  @example <caption>Example using Angular2 Component</caption>
     *  class MyComponent  {
   *     constructor() {
   *
   *     }
   *
   *     doAction(payload) {
   *        MeteorObservable.call("myData", payload).subscribe((response) => {
   *           // Handle success and response from server!
   *        }, (err) => {
   *          // Handle error
   *        });
   *     }
   *  }
     */
    public static call<T>(name: string, ...args: any[]): Observable<T> {
        const lastParam = args[args.length - 1];

        if (isMeteorCallbacks(lastParam)) {
            throw Error('MeteorObservable.call');
        }

        return Observable.create((observer: Subscriber<Meteor.Error | T>) => {
            Meteor.call(name, ...args.concat([
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
            Meteor.apply(name, args, options,
                (error: Meteor.Error, result: T) => {
                    error ? observer.error(error) : observer.next(result);
                    observer.complete();
                });
        });
    }
}



//////HELPER FUNCTIONS
export declare type CallbacksObject = {
    onReady?: Function;
    onError?: Function;
    onStop?: Function;
};

export declare type MeteorCallbacks = ((...args) => any) | CallbacksObject;

export const subscribeEvents = ['onReady', 'onError', 'onStop'];

export function isMeteorCallbacks(callbacks: any): boolean {
    return typeof callbacks === 'function' || isCallbacksObject(callbacks);
}

// Checks if callbacks of {@link CallbacksObject} type.
export function isCallbacksObject(callbacks: any): boolean {
    return callbacks && subscribeEvents.some((event) => {
        return typeof callbacks[event] === 'function';
    });
}


