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

    // name field in _columns should be one level depth to allow use TdDataTableService
    private _columns: ITdDataTableColumn[] = [
        { name: 'alias',       label: 'Alias',       filter: true},
        { name: 'conditions',  label: 'Conditions',  filter: true},
        { name: 'cells',       label: 'Cells',       filter: true},
        { name: 'description', label: 'Description', filter: true},
        { name: 'catalog',     label: 'Catalog',     filter: true},
        { name: 'created',     label: 'Created',     filter: true},
        { name: 'cwlLabel',    label: 'Pipeline',    filter: true}
    ];

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
        let dataFormated = singleSampleData.cwl.metadata;
        dataFormated["created"] = singleSampleData.date.created;
        dataFormated["_id"] = singleSampleData["_id"];
        dataFormated["cwlLabel"] = cwlData.find(singleCwl => {return singleCwl["_id"] == singleSampleData.cwl.cwlId}).description.label;
        return dataFormated;
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
