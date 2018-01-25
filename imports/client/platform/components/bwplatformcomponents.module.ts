import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

import { BWTextInput } from './bwtextinput.component';
import { BWTreeView } from './bwtreeview.component';
import { BWCloudLoader } from './bwcloudloader.component';
import { BWCloudLoaderDialog } from './bwcloudloaderdialog.component';
import { BWCloudLoaderButton } from './bwcloudloaderbutton.component';

import { BWUploadPanelModule } from './bwuploadpanel/bwuploadpanel.module';

import {
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatTooltipModule,
    MatCardModule,
    MatAutocompleteModule,
    MatIconModule,
    MatGridListModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatLineModule,
    MatListModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSidenavModule,
    MatToolbarModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatRippleModule,
    MatCommonModule
} from '@angular/material';

import {
    CovalentLayoutModule,
    CovalentNotificationsModule,
    CovalentMessageModule,
    CovalentChipsModule,
    CovalentFileModule,
    CovalentStepsModule,
    CovalentSearchModule,
    CovalentCommonModule,
    CovalentDialogsModule,
    CovalentMenuModule,
    CovalentMediaModule,
    CovalentLoadingModule,
    CovalentDataTableModule,
    CovalentPagingModule
} from '@covalent/core';


const MATERIAL_MODULES:Array<any> = [
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatTooltipModule,
    MatCardModule,
    MatAutocompleteModule,
    MatIconModule,
    MatGridListModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatLineModule,
    MatListModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSidenavModule,
    MatToolbarModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatExpansionModule,
    OverlayModule,
    MatRippleModule,
    MatCommonModule
];


const COVALENT_MODULES:Array<any> = [
    CovalentLayoutModule,
    CovalentNotificationsModule,
    CovalentMessageModule,
    CovalentChipsModule,
    CovalentFileModule,
    CovalentStepsModule,
    CovalentSearchModule,
    CovalentCommonModule,
    CovalentDialogsModule,
    CovalentMenuModule,
    CovalentMediaModule,
    CovalentLoadingModule,
    CovalentDataTableModule,
    CovalentPagingModule
];

const BW_COMPONENTS:Array<any> = [
    BWTextInput,
    BWTreeView,
    BWCloudLoader,
    BWCloudLoaderDialog,
    BWCloudLoaderButton
];

const BW_MODULES:Array<any> = [
    BWUploadPanelModule
];

@NgModule({
    declarations: [
        BW_COMPONENTS
    ],
    exports: [
        COVALENT_MODULES,
        MATERIAL_MODULES,
        BW_MODULES,
        BW_COMPONENTS
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        COVALENT_MODULES,
        MATERIAL_MODULES,
        BW_MODULES
    ],
    entryComponents: [
        BWCloudLoaderDialog  //  Need to list it here, because we create it dynamically
    ]
})
export class BWPlatformComponentsModule {}
