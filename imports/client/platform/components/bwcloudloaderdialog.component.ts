import {
    Component,
    Inject,
    Output,
    EventEmitter
} from "@angular/core";

import {
    MatDialogRef,
    MAT_DIALOG_DATA
} from "@angular/material";

import { BWComponentBase } from '../../lib'


@Component({
    template: `
        <bw-cloudloader [directories]="data.directories"
                        [label]="data.label"
                        [bwControl]="data.bwControl"
                        (selectedItems)="onSelectedItems($event)"
                        (submittedItems)="onSubmittedItems($event)"
                        (openItem)="onOpenItem($event)"
                        (previewItem)="onPreviewItem($event)">
        </bw-cloudloader>
    `
})


export class BWCloudLoaderDialog extends BWComponentBase{

    @Output() selectedItems:  EventEmitter<any> = new EventEmitter();
    @Output() submittedItems: EventEmitter<any> = new EventEmitter();
    @Output() openItem:       EventEmitter<any> = new EventEmitter();
    @Output() previewItem:    EventEmitter<any> = new EventEmitter();

    constructor(
        public dialogRef: MatDialogRef<BWCloudLoaderDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ){
        super();
    }

    onSelectedItems (payload){
        this.selectedItems.emit(payload);
    }

    onSubmittedItems (payload){
        this.submittedItems.emit(payload);
    }

    onOpenItem (payload){
        this.openItem.emit(payload);
    }


    onPreviewItem (payload){
        this.previewItem.emit(payload);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

}
