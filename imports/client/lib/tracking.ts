'use strict';

import { Subscription, Observable } from 'rxjs';
import { MeteorObservable } from './meteor.observable';

export class BWTracking {

    protected __disposables: {dispose: string, track: Object, id?: string}[] = [];

    /**
     * Tracks the given value and disposes of it when the object gets destroyed
     */
    protected set tracked(track: Object) {
        this.__disposables.push(this.getDispose(track));
    }

    /**
     *  Add track to the tracker by ID, or destroy a track just with (null,id)
     * @param track
     * @param id
     */
    protected trackedId(track: Object, id) {
        if(!id) return;

        let st = this.__disposables.find(d => d.id === id);
        if(st) {
            st.track[st.dispose]();
            this.__disposables = this.__disposables.filter( e => e.id !== id);
        }
        if(!track) return;

        let o = this.getDispose(track);
        o['id'] = id;
        this.__disposables.push(o);
    }

    /**
     *  Cleanup all tracked data.
     */
    public cleanup(){
        if(this.__disposables)
            this.__disposables.forEach(d => d.track[d.dispose]());
        this.__disposables = [];
    }

    public MeteorSubscribeAutorun<T>(name: string, ...args: any[]): Observable<T> {
        return MeteorObservable.subscribeAutorun(name,...args);
    }

    public MeteorCall<T>(name: string, ...args: any[]): Observable<T> {
        return MeteorObservable.call(name,...args);
    }

    public MeteorApply<T>(name: string, args: EJSONable[], options?: {
        wait ? : boolean;
        onResultReceived ? : Function;
    }): Observable<T> {
        return MeteorObservable.apply(name, args, options);
    }

    /**
     *
     * @param track
     * @returns {{track: any; dispose: string}}
     */
    private getDispose(track) {
        let dispose = {
            track,
            dispose: ""
        };
        if (track instanceof Subscription) {
            dispose.dispose = "unsubscribe";
        } else

        if (typeof track["stop"] === "function" && track['subscriptionId']) {
            dispose.dispose = "stop";
        } else

        if (typeof track["stop"] === "function" && track instanceof Tracker.Computation) {
            dispose.dispose = "stop";
        } else

        if (typeof track["destroy"] === "function") {
            dispose.dispose = "destroy";
        } else

        if (typeof track["dispose"] === "function") {
            dispose.dispose = "dispose";
        } else {
            throw new Error("Could not find a method that would destroy an object");
        }

        return dispose;
    }

    ngOnDestroy(): void {
        this.cleanup();
    }

}
