'use strict';
import { FormGroup, FormArray, FormControl } from '@angular/forms';

export class BasicService {

    protected _submitting = false;

    constructor (){}

    protected subscription;

    protected runWithPromise(accountFn: Function, inTimeout?: boolean): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            accountFn(this.getResolver(resolve, reject, inTimeout));
        });
    }

    protected getResolver(resolve, reject, inTimeout?: boolean): (error?: any) => void {
        var newResolve = inTimeout ? () => setTimeout(() => resolve()) : resolve;
        return error => {
            if (error) reject(error); else newResolve();
        }
    }

    public checkSubmit():boolean {
        this._submitting = true;
        var status = Meteor.status();
        if(!status['connected']) {
            this._submitting = false;
            swal({   title: 'Cannot connect to the server.', type: 'error', text: status.reason,  timer: 3000 });
        }
        return this._submitting;
    }

    protected makeData(form, value) {
        if(!form.dirty) return;
        let uo = {};
        for(let k in value) {
            var f = form.controls[k];
            if( f && f instanceof FormControl && f.dirty && f.valid) {
                uo[k] = value[k];
            }
            if( f && f instanceof FormGroup && f.dirty) {
                uo[k] = this.makeData(f,value[k]);
            }
            if( f && f instanceof FormArray && f.dirty && f.valid) {
                uo[k]=value[k];
            }

        }
        return uo;
    }


}
