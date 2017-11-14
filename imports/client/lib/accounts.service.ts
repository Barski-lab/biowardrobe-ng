import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BWServiceBase } from './service.base';


@Injectable()
export class BWAccountService extends BWServiceBase {

    constructor() {
        super();
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
            Accounts.callLoginMethod({
                methodArguments: [{email: email, pass: password, biowardrobeng: true}],
                userCallback: callback
            });
        });
        return loginObservable();
    }

}


export const ACCOUNTS_PROVIDERS: Array<any> = [
    { provide: BWAccountService, useClass: BWAccountService }
];