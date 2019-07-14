import {Component, NgZone} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { BWAccountService, BWInputEmail, BWComponentBase } from '../../lib';


@Component({
    templateUrl: './forgot.html'
})
export class BWForgot extends BWComponentBase {
    forgotForm: FormGroup;
    errorMessage;
    successMessage;

    constructor (
        protected _accounts: BWAccountService,
        protected _fb:FormBuilder,
        protected _zone: NgZone,
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
                                this.successMessage = `Email was sent.  Please check your email box for future instructions.`;
                                this.errorMessage = null;
                            } else {
                                this.successMessage = null;
                                this.errorMessage = `Failed to reset password ${res[0].reason}`;
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
