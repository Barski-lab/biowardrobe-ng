import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { BWAccountService, BWValidators, BWInputPassword, BWComponentBase } from '../../lib';

import swal from 'sweetalert2';
import '../../../../public/css/sweetalert2.css'

@Component({
    templateUrl: './reset.html'
})
export class BWReset extends BWComponentBase {
    token:string;
    resetForm: FormGroup;

    constructor(
        protected _router:Router,
        protected _route:ActivatedRoute,
        protected _accounts: BWAccountService,
        protected _fb:FormBuilder

    ) {
        super();
        this.resetForm = _fb.group({
            password: new BWInputPassword('New Password',true),
            passwordr: new BWInputPassword('Repeat Password',true),
        },{validator: BWValidators.matchingPasswords('password','passwordr')});

        this._route.params.subscribe(params => {
            this.token = params['id'];
        });
    }
    
    submit() {
        if(!this.checkSubmit()) return false;
        if (this.resetForm.valid) {
            this.tracked = this._accounts.resetPassword(this.token, this.resetForm.controls["password"].value)
                .subscribe(
                    res => {
                        // return undefined - success or Object.error - failed
                        !!res? swal({title: "Failed to reset password", text:res.reason, type: 'error', timer: 5000}) : this._router.navigate(['/platform']);
                    },
                    err => {
                        console.log(err);
                    }
                );
        } else {
            this.showError=true;
        }
        this.submitting = false;
        return false;
    }
}
