import { Component, NgZone, ViewChild, AfterViewInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { MatSelect } from '@angular/material';

import { BWDraftService, BWComponentBase, MeteorObservable } from '../../../lib'
import { BWSampleService } from '../sample.service'
import { BWCWLService } from '../../cwl/cwl.service'


@Component({
    templateUrl: './sampleedit.html'
})
export class BWSampleEdit extends BWComponentBase implements AfterViewInit {

    private _sampleId:string;
    private _cwls = [];
    private _cwlFormData: any; // Fields values for the specific cwl
    private _cwlData: any;     // Full description of selected cwl
    private _allowUpload: boolean = false;

    @ViewChild('cwlSelectForm')
    private _cwlSelectForm:NgForm;


    constructor(
        private _zone:           NgZone,
        private _router:         Router,
        private _route:          ActivatedRoute,
        private _sample:         BWSampleService,
        private _location:       Location,
        private _cwlService:     BWCWLService,
        private _draft:          BWDraftService
    ) {
        super();
    }


    ngAfterViewInit() {

        this.tracked = this._route.params
            .flatMap(params => {
                this._sampleId = params['sample_id'];
                if(this._sampleId == "new") {
                    console.log ("Trying to fetch data from Drafts");
                    return Observable
                        .combineLatest(
                            this._cwlService.getCWLs(),
                            this._draft.getDraft("cwlform"));
                }
                console.log ("Trying to fetch data from Samples");      // This is not tested yet
                return Observable
                    .combineLatest(
                        this._cwlService.getCWLs(),
                        this._sample.getSample( {_id: this._sampleId} ));
            })
            .subscribe(data => {
                this._cwls = data[0];
                let fetchedData = data[1]; // Can be either from the Drafts or from Samples
                console.log ("fetchedData", fetchedData);
                this._zone.run(() => {
                    if(this._sampleId == "new" && !!fetchedData) {
                        this._cwlFormData = fetchedData;
                        this._allowUpload = false;
                    } else if (fetchedData && fetchedData["cwl"] && fetchedData["cwl"].cwlId && this._sampleId == fetchedData["_id"] ) {
                        this._cwlFormData = fetchedData["cwl"];
                        this._allowUpload = true;
                    }
                    try {
                        let cwlId = this._cwlFormData && this._cwlFormData.cwlId ? this._cwlFormData.cwlId : null;
                        if (!!cwlId) this._cwlSelectForm.controls['cwlId'].setValue(cwlId);
                    } catch (err){
                        console.log ("Hey, our this._cwls array is empty, we cannot get this._cwls[0]._id");
                    }
                });
            });


        this.tracked = this._cwlSelectForm.valueChanges
            .subscribe((v) => {
                if(this._cwlSelectForm.controls['cwlId'].valid && !this._cwlSelectForm.controls['cwlId'].pristine){
                    this._cwlSelectForm.controls['cwlId'].markAsPristine();
                    this.tracked = this.MeteorCall("drafts/reset","cwlform", {})
                        .subscribe(
                            (res) => console.log(res),
                            (err) => console.log(err)
                        );
                }
                this._cwlData = this._cwls.find (cwl => {return cwl._id == v.cwlId});
            });


    }


    private cwlFormValueChanges(e) {
        let cwlFormData = {
            cwlId:    e.cwlId,
            inputs:   e.data.inputs,
            metadata: e.data.metadata
        };
        if(this._sampleId == "new") {
            this.tracked = this.MeteorCall("drafts/upsert","cwlform", cwlFormData).subscribe(()=>{},(er)=>{console.log(er)})
        } else {
            this.tracked = this._sample.editSample(this._sampleId, {"cwl": _.omit(cwlFormData,["cwlId"])} ).subscribe(()=>{},(er)=>{console.log(er)});
        }
    }


    private submit() {
        if(!this.checkSubmit()) return false;
        if (this._cwlService.formValid()) {
            this.tracked = this._sample.addSample().subscribe(
                (sampleId) => {
                    this._showError=false;
                    console.log("Added sample:",sampleId);
                    this._router.navigate(['/platform/sample', {sample_id: sampleId}], {replaceUrl:true});
                },
                (err) => {
                    console.log("Error:",err);
                })
        } else {
            this.showError = true;
            console.log("_cwlService.formGroup is not valid");
        }
        this.submitting = false;
    }
}
