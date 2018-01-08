import {
    Component,
    Input,
    Output,
    NgZone
} from '@angular/core';

import {
    Observable,
    Subject
} from 'rxjs';

import {
    SDInputSelect,
    BaseComponent
} from '../../../lib';

import { SDCWLService } from '../../cwl/cwl.service';

import template from './editsampleform.html';

@Component({
    selector: 'sd-edit-sample-form',
    template
})
export class SciDAPEditSampleForm extends BaseComponent {

    private sdControl:SDInputSelect = new SDInputSelect("Experiment type/CWL pipeline",true);

    private _cwlData;

    private _cwlList;
    @Input()
    set cwlList(v) {
        if(!v) return;
        this._cwlList = v;
        if(!this._cwlActive && v.length>0) {
            this.sdControl.setValue(v[0]["_id"]);
        } else if(this._cwlActive && v.length>0) {
            this.sdControl.setValue(this._cwlActive);
        }
    }

    private _cwlActive;
    @Input()
    set cwlActive(v) {
        this._cwlActive = v;
        if(!v) return;
        if(this._cwlActive && this._cwlList.length>0) {
            this.sdControl.setValue(this._cwlActive);
        }
    }

    private _cwlFormData;
    @Input("cwlFormData") set cwlFormData(value:any) {
        if(!value) return;
        this._cwlFormData = value;
    }

    private _allowUpload;
    @Input("allowUpload") set allowUpload(value:any) {
        if(!value) return;
        this._allowUpload = value;
    }

    @Output()
    valueChanges = new Subject();

    private _cache:{} = {};

    constructor(
        private _cwlService:SDCWLService,
        private _zone: NgZone
    ) {
        super();
        this.tracked = this.sdControl.valueChanges
            .flatMap((v) => {
                if(!this._cache[v])
                    return this._cwlService.getCWL(v); //TODO: cache can be part of service?
                return Observable.of(this._cache[v]);
            })
            .subscribe( cwlData => {
                this._zone.run(() => {
                    this._cwlData = cwlData;
                    this._cache[cwlData.cwl._id] = cwlData;
                });
            });
    }

    private getData(e) {
        if(!e) return;
        this.valueChanges.next(e);
    }
}
