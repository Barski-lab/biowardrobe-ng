import { Component, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormBuilder, FormGroup } from '@angular/forms';

import { BWInputEmail, BWInputPassword, BWValidators } from '../../lib';
import template from './login.html';

import { swal } from 'sweetalert2';
import '../../../../public/css/sweetalert2.css'
const swal = require('sweetalert2');


@Component({
    template
})
export class BWLogin implements OnInit {
    loginForm: FormGroup;
    private params: any;
    submitting:boolean = false;
    showError;

    constructor (
        protected _fb:FormBuilder,
        protected _route:ActivatedRoute,
        protected _router:Router,
        protected _zone: NgZone
    ) {
        this.loginForm = _fb.group({
            email: new BWInputEmail('Email',true),
            password: new BWInputPassword('Password',true),
        });
        this.loginForm.controls['password'].setValidators(BWValidators.required);
    }

    ngOnInit() {

        this._route.queryParams.subscribe(params => {
            this.params = params;
            if(!!this.params.email){
                this.loginForm.controls['email'].setValue(this.params.email, {emitEvent: false});
            } else {
                if(localStorage.getItem('corporateEmail') !== "") {
                    this.loginForm.controls['email'].setValue(localStorage.getItem('corporateEmail'), {emitEvent: false});
                }
            }

            Meteor.subscribe('authorizedOAuth');

            Tracker.autorun((c) => {
                let user = Meteor.user();
                if(user && user._id && this.params && this.params.client_id) {
                    c.stop();
                    this.post('',{
                        "allow": 'yes',
                        "token": localStorage.getItem('Meteor.loginToken'),
                        "client_id": this.params.client_id,
                        "redirect_uri": this.params.redirect_uri,
                        "response_type": "code",
                        "state":this.params.state
                    });
                } else if (user && user._id) {
                    this._router.navigate(['/authorized']);
                }
            });
        });
    }

    isInvalid(comp):boolean {
        if(comp && comp instanceof FormControl && comp.errors )
            return !!this.showError && !!comp.errors;

        if(comp && comp instanceof FormGroup)
            return !!this.showError && !comp.valid;

        return false;
    }

    post(path, params) {
        let method = "post";

        let form = document.createElement("form");
        form.setAttribute("method", method);
        form.setAttribute("action", path);

        for(let key in params) {
            if(params.hasOwnProperty(key)) {
                let hiddenField = document.createElement("input");
                hiddenField.setAttribute("type", "hidden");
                hiddenField.setAttribute("name", key);
                hiddenField.setAttribute("value", params[key]);
                form.appendChild(hiddenField);
            }
        }

        document.body.appendChild(form);
        form.submit();
    }

    submit() {
        let self = this;
        if (this.loginForm.valid) {
            this.submitting = true;
            localStorage.setItem('corporateEmail', this.loginForm.controls['email'].value);
            Accounts.callLoginMethod({
                methodArguments: [{email: this.loginForm.controls['email'].value, pass: this.loginForm.controls['password'].value, biowardrobeng: true }],
                userCallback: (e) => {
                    self._zone.run(()=>{
                        self.submitting = false;
                    });
                    if(e)
                        swal({title: 'Incorrect credentials.',text: e.reason, type: 'error', timer: 4000});
                }
            });
        }
    }

}