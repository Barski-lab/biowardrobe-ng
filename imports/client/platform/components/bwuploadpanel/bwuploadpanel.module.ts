import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser";

import {
    MatLineModule,
    MatRippleModule,
    MatCommonModule,
    MatProgressBarModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule
} from '@angular/material';
import { CovalentFileModule } from "@covalent/core";

import {BWUploadPanel} from "./bwuploadpanel.component";
import {BWCancelDialog} from "./bwcanceldialog.component";


@NgModule({
    declarations:[
        BWUploadPanel,
        BWCancelDialog
    ],
    exports:[
        BWUploadPanel
    ],
    imports:[
        CommonModule,
        BrowserModule,
        MatLineModule,
        MatRippleModule,
        MatCommonModule,
        MatProgressBarModule,
        MatCardModule,
        CovalentFileModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        MatTooltipModule,
        MatDialogModule
    ],
    entryComponents: [ BWCancelDialog ]
})
export class BWUploadPanelModule{}