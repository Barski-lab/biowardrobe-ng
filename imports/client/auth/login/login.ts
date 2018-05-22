import { Component, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';

import { BWInputEmail, BWInputPassword, BWValidators, BWComponentBase, BWAccountService } from '../../lib';

import swal from 'sweetalert2';
import '../../../../public/css/sweetalert2.css'

@Component({
    templateUrl: './login.html'
})
export class BWLogin extends BWComponentBase implements OnInit {
    public loginForm: FormGroup;
    private params: any;

    constructor (
        protected _fb:FormBuilder,
        protected _route:ActivatedRoute,
        protected _router:Router,
        protected _zone: NgZone,
        protected _accounts: BWAccountService,
    ) {
        super();
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
        if(!this.checkSubmit()) return false;
        if (this.loginForm.valid) {
            localStorage.setItem('corporateEmail', this.loginForm.controls['email'].value);
            this.tracked = this._accounts.login(this.loginForm.controls['email'].value, this.loginForm.controls['password'].value)
                .subscribe(
                    res => {
                        // return undefined - success or Object.error - failed
                        !!res && swal({title: 'Incorrect credentials', text: res.reason, type: 'error', timer: 5000});
                    },
                    err => {
                        console.log (err)
                    }
                );
        } else {
            this.showError=true; // Why do we need this showError at all?
        }
        this.submitting = false; // Check is we need it end do we really display its changes, do we need to add zone.run?
    }

}