import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { BasicService } from './basic.service';

@Injectable()
export class AccountService extends BasicService {

    constructor() {
        super();
    }

    forgotPassword(email:string):Promise<any> {
        var accountFn = Accounts.forgotPassword.bind(null, {email: email});
        return this.runWithPromise(accountFn);
    }

    resetPassword(token:string, newPassword:string):Promise<any> {
        var accountFn = Accounts.resetPassword.bind(null, token, newPassword);
        return this.runWithPromise(accountFn);
    }
}


