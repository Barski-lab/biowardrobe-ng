import { Component, NgZone, ViewChild, AfterViewInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { MatSelect } from '@angular/material';

import { BWDraftService, BWComponentBase, MeteorObservable } from '../../../lib'
import { BWSampleService } from '../sample.service'
import { BWCWLService } from '../../cwl/cwl.service'

import template from './sampleedit.html';

@Component({
    template
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
                    this.tracked = MeteorObservable.call("drafts/reset","cwlform", {})
                        .subscribe(
                            (res) => console.log(res),
                            (err) => console.log(err)
                        );
                }
                this._cwlData = this._cwls.find (cwl => {return cwl._id == v.cwlId});
            });


    }


    private cwlFormValueChanges(e) {
        if(this._sampleId == "new") {
            let cwlFormData = {
                cwlId:    e.cwlId,
                inputs:   e.data.inputs,
                metadata: e.data.metadata
            };
            console.log("cwlFormValueChanges drafts/upsert", cwlFormData);
            this.tracked = MeteorObservable.call("drafts/upsert","cwlform", cwlFormData)
                .subscribe(
                    (res) => console.log(res),
                    (err) => console.log(err)
                );
        }
    }


    private submit() {
        // if(!this.checkSubmit()) return false;
        // if (this._cwlFormService.formGroupMetadata.valid && this._cwlFormService.formValid()) {
        //     this._sample.addSampleTransfer()
        //         .then(
        //             (o) => {
        //                 this._showError=false;
        //                 console.log("Ok:",o);
        //                 this._router.navigate(['/platform/sample', {project_id: this.project_id, sample_id: o}], {replaceUrl:true});
        //             },
        //             (e) => {
        //                 console.log("Error:",e);
        //             }
        //         );
        // } else {
        //     this._showError=true;
        // }
        // this._submitting = false;
    }

}
