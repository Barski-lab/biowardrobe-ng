import { Component, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';

import { BWInputEmail, BWInputPassword, BWValidators, BWComponentBase, BWAccountService } from '../../lib';

// import {TdDialogService} from "@covalent/core";
import {Session} from "meteor/session";
import {Tracker} from "meteor/tracker";
import {switchMap} from "rxjs/operators";

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
        // protected _dialogService: TdDialogService
    ) {
        super();
        this.loginForm = _fb.group({
            email: new BWInputEmail('Email',true),
            password: new BWInputPassword('Password',true),
        });
        this.loginForm.controls['password'].setValidators(BWValidators.required);
    }

    ngOnInit() {

        this.tracked = this._route.queryParams.pipe(
            switchMap((params) => {
                this.params = params;
                if(!!this.params.email){
                    this.loginForm.controls['email'].setValue(this.params.email, {emitEvent: false});
                } else {
                    if(localStorage.getItem('corporateEmail') !== "") {
                        this.loginForm.controls['email'].setValue(localStorage.getItem('corporateEmail'), {emitEvent: false});
                    }
                }
                return this._accounts.account$;
            })
        ).subscribe( (c) => {
            // console.log(c, c.isLoggedIn);
            if (c.isLoggedIn) {
                if(this.params && this.params.client_id) {
                    let { client_id, redirect_uri, state } =  this.params;
                    setTimeout( () => {
                        this.post('/oauth/authorize', {
                            "allow": 'yes',
                            "token": localStorage.getItem('Meteor.loginToken'),
                            "client_id": client_id,
                            "redirect_uri": redirect_uri,
                            "response_type": "code",
                            "state": state
                        });
                    }, 1000 );
                    // setTimeout(()=> {
                    this._zone.run(() => {
                        this._router.navigate(['/authorized']);
                    });
                    // },100)
                } else {
                    if (c['redirected']) { return; }
                    c['redirected'] = true;
                    Tracker.nonreactive(() => {
                        this._zone.run(() => {
                            const url = Session.get('lastNavigationAttempt');
                            if (url) {
                                Session.set('lastNavigationAttempt', null);
                                this._router.navigateByUrl(url);
                            } else {
                                this._router.navigate(['/authorized']);
                            }
                        });
                    });
                }
            }
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
                        console.log (res);
                        // return undefined - success or Object.error - failed
                        if(res[0]) {
                            this._zone.run(() => {
                                // this._dialogService.openAlert({title: 'Incorrect credentials', message: res[0].message});
                            });
                        }
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
