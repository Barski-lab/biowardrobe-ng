import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { BWAccountService, BWInputEmail, BWComponentBase } from '../../lib';

import template from './forgot.html'

import swal from 'sweetalert2';
import '../../../../public/css/sweetalert2.css'


@Component({
    template
})
export class BWForgot extends BWComponentBase {
    forgotForm: FormGroup;

    constructor (
        protected _accounts: BWAccountService,
        protected _fb:FormBuilder
    ) {
        super();
        this.forgotForm = _fb.group({
            email: new BWInputEmail('Email',true)
        });
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
                        if (!res[0]){
                            swal({title: 'Email was sent.', text:'Please check your email box for future instructions.', type: 'success', timer: 5000});
                        } else {
                            swal({title: "Failed to reset password", text:res[0].reason, type: 'error', timer: 5000});
                        }
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
