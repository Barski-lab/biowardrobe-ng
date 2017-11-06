import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { AccountService, BWInputEmail } from '../../lib';
import { BWAuthBase } from '../auth.base'

import template from './forgot.html'

import swal from 'sweetalert2';
import '../../../../public/css/sweetalert2.css'
const swal = require('sweetalert2');  // maybe we don't need it?


@Component({
    template
})
export class BWForgot extends BWAuthBase {
    forgotForm: FormGroup;


    constructor (
        protected _accounts: AccountService,
        protected _fb:FormBuilder
    ) {
        super();
        this.forgotForm = _fb.group({
            email: new BWInputEmail('Email',true)
        });
    }


    submit() {
        if (this.forgotForm.valid) {
            this.submitting = true;
            this._accounts.forgotPassword(this.forgotForm.controls["email"].value)
                .then((o) => {
                    swal({title: 'Email was sent.', text:'Please check your email box for future instructions.', type: 'success', timer: 5000});
                }
                ,(rej) => {
                    if (rej.error == 401){
                        swal({title: "Access denied", text:"You are not allowed to reset password", type: 'warning', timer: 5000});
                    } else {
                        swal({title: "Failed to reset password", text:"Make sure you set correct email", type: 'error', timer: 5000});
                    }
                }
            );
        } else {
            this.showError=true;
        }
        this.submitting = false;
    }
}
