'use strict';

import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, BehaviorSubject } from 'rxjs';
import { WorkflowFactory } from 'cwlts/models';

import { CWLs } from '../../../collections/shared';

import {
    BWServiceBase,
    BWInputFile,
    BWInputText,
    BWInputNumber,
    BWInputCheckbox
} from '../../lib';


const YAML = require('js-yaml');


// Use any, because model's class depends on cwl version
interface CwlParsed {
    cwlData:any;
    cwlMainModel:any;
    cwlMetadataModels:any
}



@Injectable()
export class BWCWLService extends BWServiceBase {

    private _formTemplateAdvanced:any = [];
    public get formTemplateAdvanced() {
        return this._formTemplateAdvanced;
    }

    private _formTemplateGeneral:any = [];
    public get formTemplateGeneral() {
        return this._formTemplateGeneral;
    }
    // for General and Advanced inputs
    private _formGroupInputs:FormGroup = new FormGroup({});
    public get formGroupInputs() {
        return this._formGroupInputs;
    }

    private _formGroupMetadata:FormGroup = new FormGroup({});
    public get formGroupMetadata() {
        return this._formGroupMetadata;
    }

    private _formTemplateMetadata:any = [];
    public get formTemplateMetadata() {
        return this._formTemplateMetadata;
    }

    private _cwlId: string;

    constructor() {
        super();
    }

    public getCWLs(params = {}):Observable<any> {
        console.log ("getCWLs");
        return this.MeteorSubscribeAutorun("cwl/list", params, () => {
            let cwls = CWLs.find(params).fetch();
            return cwls;
        }).shareReplay(1);
    }

    private _templatePush(inputs, meta?:boolean) {
        let _destination;

        if(inputs.customProps['sd:layout'] && inputs.customProps['sd:layout']['advanced']) { // change sd:layout to bw:layout and in cwl in DB too
            if( meta ) {
                throw new Error('metadata can not have advanced fields!');
            }
            _destination = this._formTemplateAdvanced;
        } else if(!meta) {
            _destination = this._formTemplateGeneral;
        } if(meta) {
            _destination = this._formTemplateMetadata;
        }

        _destination.push({
            key: inputs.id,
            type: inputs.type.type
        });
    }


    private setForm(cwlParsed: CwlParsed) {

        cwlParsed.cwlMetadataModels.forEach(x => x.inputs.forEach(e => {
            if (e.type.type == "string") {
                this._formGroupMetadata.addControl(e.id, new BWInputText(e.label, !e.type.isNullable));
                this._templatePush(e, true);
            }
        }));


        cwlParsed.cwlMainModel.inputs.forEach( e => {
            if( e.customProps['sd:parent'] ) {

            } else  if( e.customProps['s:isBasedOn'] ) {

            } else if( e.type.type == "File" ) {
                this._formGroupInputs.addControl(e.id, new BWInputFile(e.label,!e.type.isNullable));
                this._templatePush(e);
            } else if( e.type.type == "string" ){
                this._formGroupInputs.addControl(e.id, new BWInputText(e.label,!e.type.isNullable));
                this._templatePush(e);
            } else if( e.type.type == "int" || e.type.type == "float" || e.type.type == "long" || e.type.type == "double" ){
                this._formGroupInputs.addControl(e.id, new BWInputNumber(e.label,!e.type.isNullable));
                this._templatePush(e)
            } else if( e.type.type == "boolean" ){
                this._formGroupInputs.addControl(e.id, new BWInputCheckbox(e.label));
                this._templatePush(e)
            } else {
                this._formGroupInputs.addControl(e.id, new BWInputText(e.label,!e.type.isNullable));
                this._templatePush(e)
            }
        });
    }


    private resetForm () {
        console.log ("resetForm");
        this._formTemplateGeneral = [];
        this._formTemplateAdvanced = [];
        this._formGroupInputs = new FormGroup({});

        this._formTemplateMetadata = [];
        this._formGroupMetadata = new FormGroup({});

        this.formGroup = new FormGroup({
            metadata: this._formGroupMetadata,
            inputs: this._formGroupInputs
        });
    }

    public getModel(r) {
        return WorkflowFactory.from(r, "document");
    }

    public parseCWL(cwlData):CwlParsed {
        let cwlSourceParsed = YAML.safeLoad(cwlData.source.source);
        cwlSourceParsed['tags'] = cwlSourceParsed['tags'] || [];
        cwlSourceParsed['servicetags'] = cwlSourceParsed['servicetags'] || [];
        let cwlModel = this.getModel(cwlSourceParsed);
        let cwlMetaModels = [] ;
        if(cwlData['metadata'] && _.isArray(cwlData['metadata'])) {
            cwlMetaModels = cwlData['metadata'].map(m => this.getModel(YAML.safeLoad(m.source)));
        }
        return {
            cwlData: cwlData,
            cwlMainModel: cwlModel,
            cwlMetadataModels: cwlMetaModels
        }
    }


    public setCwlData(cwlData) {
        console.log ("setCwlData");
        try {
            this.resetForm();
            let cwlParsed = this.parseCWL(cwlData);
            this.setForm(cwlParsed);
            this._cwlId = cwlData._id;
        } catch (err){
            console.log ("Unexpected Error", err);
        }
        return this.valueChanges
    }


    private get valueChanges():Observable<any> {
        return this.formGroup.valueChanges
            .debounceTime(1000)
            .map( data => {
                return {
                    cwlId: this._cwlId,
                    data: {  // better to take from formGroup, not from _formGroupMetadata and _formGroupInputs
                        metadata: this.makeData(this._formGroupMetadata, data['metadata']),
                        inputs: this.makeData(this._formGroupInputs, data['inputs'])
                    },
                    forms: {
                        templateGeneral: this._formTemplateGeneral,
                        templateAdvanced: this._formTemplateAdvanced,
                        templateMetadata: this._formTemplateMetadata
                    }
                }
            })
    }

    public updateFormGroupData(metadata, inputs) {
        this.setFieldsFromDB(inputs,   this._formGroupInputs);
        this.setFieldsFromDB(metadata, this._formGroupMetadata);
    }

}


