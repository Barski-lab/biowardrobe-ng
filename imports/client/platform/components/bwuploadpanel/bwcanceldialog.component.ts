import { Component } from "@angular/core";

import { MatDialog, MatDialogRef } from "@angular/material";

import template from "./bwcanceldialog.html"

@Component({
    template
})

export class BWCancelDialog{
    constructor(public dialogRef: MatDialogRef<BWCancelDialog>, public dialog: MatDialog) {}
}