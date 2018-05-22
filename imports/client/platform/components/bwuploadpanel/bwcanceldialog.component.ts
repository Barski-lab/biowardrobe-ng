import { Component } from "@angular/core";

import { MatDialog, MatDialogRef } from "@angular/material";


@Component({
    templateUrl: "./bwcanceldialog.html"
})

export class BWCancelDialog{
    constructor(public dialogRef: MatDialogRef<BWCancelDialog>, public dialog: MatDialog) {}
}