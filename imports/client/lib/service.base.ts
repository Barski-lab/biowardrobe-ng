'use strict';
import { FormGroup, FormArray, FormControl } from '@angular/forms';

import { BWTracking } from './tracking';


export class BWServiceBase extends BWTracking {

    protected _submitting = false;
    protected formGroup:FormGroup;

    constructor (){
        super();
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

    formValid():boolean {
        return this.formGroup.valid;
    }

    getForm():FormGroup {
        return this.formGroup;
    }

    protected setFieldsFromDB(v, form?) {
        if ( !form ) form=this.formGroup;
        if ( !form ) return;
        if ( !v ) v=[];

        _.keys(form.controls)
            .forEach( k => {
                if (form.controls[k] instanceof FormControl)
                    form.controls[k].reset(v && v[k] || null, {onlySelf: false, emitEvent: false});

                if (form.controls[k] instanceof FormGroup)
                    this.setFieldsFromDB(v[k], form.controls[k]);

                if (form.controls[k] instanceof FormArray) {
                    let a = v && v[k] || [];
                    a.forEach( e => {
                        form.controls[k].push(new FormControl(e))
                    });
                }
            })
    }

}
