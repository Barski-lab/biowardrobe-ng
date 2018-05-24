import { Meteor } from 'meteor/meteor';
import { Session} from 'meteor/session';

import {Injectable, NgZone} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from '@angular/router';

import { Observable } from 'rxjs';

import { BWServiceBase } from './service.base';
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import {Tracker} from "meteor/tracker";

const loginRoute = ['/login'];


@Injectable()
export class BWAccountService extends BWServiceBase {

    currentUser;
    _currentUserId;
    isLoggedIn;
    isLoggingIn;


    private _account$: BehaviorSubject<BWAccountService> = new BehaviorSubject<BWAccountService>(null);
    public get account$(): Observable<BWAccountService> {
        return this._account$.filter(_ => !!_);
    }

    constructor(private _zone: NgZone, private _router: Router) {
        super();

        Tracker.autorun((c) => {
            this.currentUser = Meteor.user();
            this._currentUserId = Meteor.userId();
            this.isLoggedIn = !!this.currentUser;
            this.isLoggingIn = Meteor.loggingIn();
            this._account$.next(this);
        });
    }

    forgotPassword(email:string):Observable<any> {
        let accountFn = Observable.bindCallback(Accounts.forgotPassword);
        return accountFn({email: email});
    }

    resetPassword(token:string, newPassword:string):Observable<any> {
        let accountFn = Observable.bindCallback(Accounts.resetPassword);
        return accountFn(token, newPassword);
    }

    login(email:string, password:string):Observable<any> {
        let loginObservable = Observable.bindCallback(function (callback) {
            Accounts['callLoginMethod']({
                methodArguments: [{email: email, pass: password, biowardrobeng: true}],
                userCallback: callback
            });
        });
        return loginObservable();
    }

}

/**
 *
 * Logged in guard protects access to authorization required routes
 *
 */
@Injectable()
export class LoggedInGuard implements CanActivate {

    constructor(private _authService: BWAccountService, private _router: Router) {
    }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<any> {
        return this._authService.account$.map((account) => {
            if (!account.isLoggedIn) {
                console.log('guard', state.url);
                Session.set('lastNavigationAttempt', state.url);
                this._router.navigate(loginRoute);
                return false;
            }
            return true;
        });
    }
}
