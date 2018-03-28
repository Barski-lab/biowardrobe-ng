import { Component, NgZone, AfterViewInit } from '@angular/core';
import { ITdDataTableColumn } from '@covalent/core';

import { BWComponentBase } from '../../../lib'
import { BWSampleService } from '../sample.service'
import { BWCWLService } from '../../cwl/cwl.service'
import { Router } from '@angular/router';

import template from './samplelist.html';

@Component({
    template
})
export class BWSampleList extends BWComponentBase implements AfterViewInit {

    private _data = [];
    private _columns: ITdDataTableColumn[] = [
        { name: 'cwl.metadata.alias',            label: 'Alias'},
        { name: 'cwl.metadata.conditions',       label: 'Conditions'},
        { name: 'cwl.metadata.cells',            label: 'Cells'},
        { name: 'cwl.metadata.description',      label: 'Description'},
        { name: 'cwl.metadata.catalog',          label: 'Catalog'},
        { name: 'date.created',                  label: 'Created'},
        { name: 'cwl.cwlLabel',                  label: 'Pipeline'}
    ];

    onSearch (payload){
        console.log ("onSearch", payload);
    }

    onRowClick (payload){
        this._router.navigate(['/platform/sample', {sample_id: payload.row._id}]);
    }

    constructor(
        private _sample: BWSampleService,
        private _zone: NgZone,
        private _router: Router,
        private _cwlService: BWCWLService,
    ) {
        super();
    }

    private _refactorSampleData(singleSampleData, cwlData){
        singleSampleData.cwl["cwlLabel"] = cwlData.find(singleCwl => {return singleCwl["_id"] == singleSampleData.cwl.cwlId}).description.label;
        singleSampleData.date.created = singleSampleData.date.created.toISOString().substr(0,10);
        return singleSampleData;
    }

    ngAfterViewInit() {
        this.tracked = this._sample.getSampleAll()
            .combineLatest(this._cwlService.getCWLs())
            .subscribe(dataCombined => {
                this._zone.run(() => {
                    this._data = dataCombined[0].map(singleSampleData => {
                        return this._refactorSampleData(singleSampleData, dataCombined[1]);
                    });
                });
            });
    }


}
