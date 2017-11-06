import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AccountService, BWValidators, BWInputPassword } from '../../lib';
import { BWAuthBase } from '../auth.base'

import template from './reset.html';

@Component({
    template
})
export class BWReset extends BWAuthBase {
    token:string;
    resetForm: FormGroup;

    constructor(
        protected _router:Router,
        protected _route:ActivatedRoute,
        protected _accounts: AccountService,
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
        if (this.resetForm.valid) {
            this.submitting = true;
            this._accounts.resetPassword(this.token, this.resetForm.controls["password"].value).then((o) => {
                    console.log(o);
                    this._router.navigate(['/platform']);
                },(rej) => {
                    console.log(rej);
                }
            );
        } else {
            this.showError=true;
        }
        this.submitting = false;
        return false;
    }
}
