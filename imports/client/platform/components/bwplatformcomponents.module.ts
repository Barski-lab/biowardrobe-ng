import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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

@NgModule({
    exports: [
        COVALENT_MODULES
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        COVALENT_MODULES
    ]
})
export class BWPlatformComponentsModule {}
