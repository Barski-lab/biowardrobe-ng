import { Component, NgZone, AfterViewInit } from '@angular/core';
import { ITdDataTableColumn } from '@covalent/core';

import { BWComponentBase } from '../../../lib'
import { BWSampleService } from '../sample.service'
import { BWCWLService } from '../../cwl/cwl.service'
import { Router } from '@angular/router';


@Component({
    templateUrl: './samplelist.html'
})
export class BWSampleList extends BWComponentBase implements AfterViewInit {

    private _data = [];

    // name field in _columns should be one level depth to allow use TdDataTableService
    private _columns: ITdDataTableColumn[] = [
        { name: 'author',      label: 'Author',       filter: true},
        { name: 'alias',       label: 'Alias',       filter: true},
        { name: 'genome',      label: 'Genome',      filter: true},
        { name: 'conditions',  label: 'Conditions',  filter: true},
        { name: 'cells',       label: 'Cells',       filter: true},
        { name: 'description', label: 'Description', filter: true},
        { name: 'catalog',     label: 'Catalog',     filter: true},
        { name: 'created',     label: 'Created',     filter: true, format: fullDate => fullDate.toISOString().substr(0,10) },
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
        let dataFormated = singleSampleData.metadata || {};
        dataFormated["author"] = singleSampleData["author"];
        dataFormated["created"] = singleSampleData.date? singleSampleData.date.created: "";
        dataFormated["_id"] = singleSampleData["_id"];
        let currentCWL = cwlData.find(singleCwl => {return singleCwl["_id"] == singleSampleData.cwlId});
        dataFormated["cwlLabel"] = currentCWL.description.label;
        dataFormated["description"] = currentCWL.description.doc;

        return dataFormated;
    }

    ngAfterViewInit() {
        this.tracked = this._sample.getSampleAll()
            .combineLatest(this._cwlService.getCWLs())
            .subscribe(dataCombined => {
                console.log(dataCombined);
                this._zone.run(() => {
                    this._data = dataCombined[0].map(singleSampleData => {
                        return this._refactorSampleData(singleSampleData, dataCombined[1]);
                    });
                });
            });
    }


}
