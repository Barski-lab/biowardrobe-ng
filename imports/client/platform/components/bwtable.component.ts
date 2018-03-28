import {
    Component,
    Input,
    Output,
    EventEmitter
} from '@angular/core';

import { ITdDataTableColumn, TdDataTableSortingOrder } from '@covalent/core';

import { BWComponentBase } from '../../lib'


@Component({
    selector: 'bw-table',
    template: `
        <mat-card>
            <div layout="row" layout-align="start center" class="pad-left-sm pad-right-sm">
            <span *ngIf="!searchBox.searchVisible" class="push-left-sm">
                <span class="mat-title">{{label}}</span>
            </span>
                <td-search-box #searchBox backIcon="arrow_back" class="push-right-sm" placeholder="Search here" (searchDebounce)="onSearch($event)" flex>
                </td-search-box>
            </div>

            <mat-divider></mat-divider>

            <mat-card-content>

                <td-data-table
                        #dataTable
                        [data]="data"
                        [columns]="columns"
                        [clickable]="clickable"
                        [sortable]="sortable"
                        (rowClick)="onRowClick($event)"
                        [sortBy]="sortBy"
                        [sortOrder]="sortOrder"
                        (sortChange)="onSortChange($event)">
                </td-data-table>

                <div class="mat-padding" *ngIf="!dataTable.hasData" layout="row" layout-align="center center">
                    <h3>No results to display.</h3>
                </div>
                
            </mat-card-content>

        </mat-card>
`
})


export class BWTable extends BWComponentBase {
    @Input() data: any[];
    @Input() columns: ITdDataTableColumn[];
    @Input() label: string = "Label";
    @Input() sortBy?: string;
    @Input() sortOrder?: TdDataTableSortingOrder;
    @Input() clickable?: boolean;
    @Input() sortable?: boolean;


    @Output() search: EventEmitter<any> = new EventEmitter();
    @Output() sortChange: EventEmitter<any> = new EventEmitter();
    @Output() rowClick: EventEmitter<any> = new EventEmitter();

    onSearch (payload){
        this.search.emit(payload);
    }

    onSortChange (payload){
        this.sortChange.emit(payload);
    }

    onRowClick (payload){
        this.rowClick.emit(payload);
    }

    constructor(
    ) {
        super();
    }

}

