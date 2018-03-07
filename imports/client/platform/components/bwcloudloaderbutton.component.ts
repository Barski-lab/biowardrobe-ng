import {
    Component,
    Input,
    Output,
    EventEmitter
} from "@angular/core";

import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material';

import { BWComponentBase } from '../../lib'
import { BWCloudLoaderDialog } from './bwcloudloaderdialog.component'

@Component({
    selector: 'bw-cloudloader-button',
    template:`<button mat-raised-button (click)="openDialog()">{{label}}</button>`
})

export class BWCloudLoaderButton extends BWComponentBase {
    @Input()  directories = [];
    @Input()  label: string = "Your label here";
    @Input()  bwControl:      FormControl; // to contain submitted Object(s)
    @Output() selectedItems:  EventEmitter<any> = new EventEmitter();
    @Output() submittedItems: EventEmitter<any> = new EventEmitter();
    @Output() openItem:       EventEmitter<any> = new EventEmitter();
    @Output() previewItem:    EventEmitter<any> = new EventEmitter();


    constructor(
        private _dialog: MatDialog,
    ) {
        super();
    }

    openDialog(): void {
        const dialogRef = this._dialog.open(BWCloudLoaderDialog, {
            width: '800px',
            data: {
                directories: this.directories,
                label:       this.label,
                bwControl:   this.bwControl
            }
        });

        const subSelectedItems = dialogRef.componentInstance.selectedItems.subscribe(
            (payload) => {this.selectedItems.emit(payload)}
        );

        const subSubmittedItems = dialogRef.componentInstance.submittedItems.subscribe(
            (payload) => {this.submittedItems.emit(payload)}
        );

        const subOpenItem = dialogRef.componentInstance.openItem.subscribe(
            (payload) => {this.openItem.emit(payload)}
        );

        const subPreviewItem = dialogRef.componentInstance.previewItem.subscribe(
            (payload) => {this.previewItem.emit(payload)}
        );

        dialogRef.afterClosed().subscribe(result => {
            console.log('The dialog was closed, unsubscribe');
            subSelectedItems.unsubscribe();
            subSubmittedItems.unsubscribe();
            subOpenItem.unsubscribe();
            subPreviewItem.unsubscribe();
        });
    }

}
