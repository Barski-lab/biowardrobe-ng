import { Component, NgZone } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { BWAccountService, BWValidators, BWInputPassword, BWComponentBase } from '../../lib';

// import { TdDialogService } from '@covalent/core';


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
        protected _fb:FormBuilder,
        protected _zone: NgZone,
        // protected _dialogService: TdDialogService
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
                .subscribe((o:any) => {
                        console.log(o);
                        if(o && o[0] && o[0].message) {
                            this._zone.run(() => {
                                // this._dialogService.openAlert({title: "Can't reset password", message: o[0].message});
                            });
                            return;
                        }
                        this._zone.run(() => {
                            this._router.navigate(['/platform']);
                        })
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
