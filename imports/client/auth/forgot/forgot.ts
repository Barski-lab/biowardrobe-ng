import {Component, NgZone} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { BWAccountService, BWInputEmail, BWComponentBase } from '../../lib';


// import {TdDialogService} from "@covalent/core";


@Component({
    templateUrl: './forgot.html'
})
export class BWForgot extends BWComponentBase {
    forgotForm: FormGroup;

    constructor (
        protected _accounts: BWAccountService,
        protected _fb:FormBuilder,
        protected _zone: NgZone,
        // protected _dialogService: TdDialogService
    ) {
        super();
        this.forgotForm = _fb.group({
            email: new BWInputEmail('Email',true)
        });

        if(localStorage.getItem('corporateEmail') !== "") {
            this.forgotForm.controls['email'].setValue(localStorage.getItem('corporateEmail'), {emitEvent: false});
        }
    }

    submit() {
        if(!this.checkSubmit()) return false;
        if (this.forgotForm.valid) {
            this.tracked = this._accounts.forgotPassword(this.forgotForm.controls["email"].value)
                .subscribe(
                    res => {
                        // returns [error, result] as normal method call callback
                        // [undefined, undefined] - success
                        // [error, undefined] - failure
                        this._zone.run(() => {
                            if (!res[0]){
                                // this._dialogService.openAlert({title: 'Email was sent.', message: 'Please check your email box for future instructions.'});
                            } else {
                                // this._dialogService.openAlert({title: "Failed to reset password", message: res[0].reason});
                            }
                        });

                    },
                    err => {
                        console.log (err)
                    }
                );
        } else {
            this.showError=true;
        }
        this.submitting = false;
    }
}
