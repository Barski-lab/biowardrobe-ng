import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit
} from '@angular/core';

import { ITdDataTableColumn, TdDataTableSortingOrder, TdDataTableService } from '@covalent/core';

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
                        [data]="filteredData"
                        [columns]="columns"
                        [clickable]="clickable"
                        [selectable]="selectable"
                        [multiple]="multiple"
                        [sortable]="sortable"
                        (rowClick)="onRowClick($event)"
                        [sortBy]="sortBy"
                        [sortOrder]="sortOrder"
                        (sortChange)="onSortChange($event)">
                </td-data-table>

                <div class="mat-padding" *ngIf="!dataTable.hasData" layout="row" layout-align="center center">
                    <h3>No results to display.</h3>
                </div>
                <td-paging-bar #pagingBar [pageSize]="pageSize" [total]="filteredTotal" (change)="onPage($event)">
                    <span hide-xs>Rows per page:</span>
                    <mat-select [style.width.px]="50" [(ngModel)]="pageSize">
                        <mat-option *ngFor="let size of [25,50,100,150]" [value]="size">
                            {{size}}
                        </mat-option>
                    </mat-select>
                    {{pagingBar.range}} <span hide-xs>of {{pagingBar.total}}</span>
                </td-paging-bar>
            </mat-card-content>

        </mat-card>
`
})


export class BWTable extends BWComponentBase implements OnInit{

    private _data = [];
    filteredData = [];
    filteredTotal = 0;
    searchTerm = '';
    fromRow = 1;
    currentPage = 1;
    pageSize = 25;
    sortBy = ''; // TODO check if empty line is ok
    sortOrder = TdDataTableSortingOrder.Descending;


    @Input() label = "Label";
    @Input('data') set data(value: any[]) {
        if(!value) return;
        this._data = value;
        this.filteredData = this._data;
        this.filteredTotal = this._data.length
    }
    @Input() columns: ITdDataTableColumn[];
    @Input() clickable?: boolean;
    @Input() selectable?: boolean;
    @Input() multiple?: boolean;
    @Input() sortable?: boolean;


    @Output() rowClick: EventEmitter<any> = new EventEmitter();


    onSearch (payload){
        this.searchTerm = payload;
        this.filter();
    }

    onSortChange (payload){
        this.sortBy = payload.name;
        this.sortOrder = payload.order;
        this.filter();
    }

    onPage(payload){
        this.fromRow = payload.fromRow;
        this.currentPage = payload.page;
        this.pageSize = payload.pageSize;
        this.filter();
    }

    onRowClick (payload){
        this.rowClick.emit(payload);
    }

    constructor(
        private _dataTableService: TdDataTableService
    ) {
        super();
    }

    filter(){
        let newData = this._data;
        let excludedColumns = this.columns
            .filter((column) => {
                return ((column.filter === undefined && column.hidden === true) ||
                    (column.filter !== undefined && column.filter === false));
            }).map((column) => {
                return column.name;
            });
        newData = this._dataTableService.filterData(newData, this.searchTerm, true, excludedColumns);
        this.filteredTotal = newData.length;
        newData = this._dataTableService.sortData(newData, this.sortBy, this.sortOrder);
        newData = this._dataTableService.pageData(newData, this.fromRow, this.currentPage * this.pageSize);
        this.filteredData = newData;
    }


}

