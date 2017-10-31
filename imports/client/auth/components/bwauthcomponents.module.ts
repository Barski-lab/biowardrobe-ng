import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { BWDirectivesModule } from '../../lib';

import { BWTextInput } from './bwtextinput/bwtextinput.component';
import { BWBox } from './bwbox/bwbox.component';
import { BWPanel } from './bwpanel/bwpanel.component';
import { BWCopyright } from './bwcopyright/bwcopyright.component';


@NgModule({
    imports: [
        ReactiveFormsModule,
        FormsModule,
        BWDirectivesModule,
        CommonModule
    ],
    exports: [
        BWTextInput,
        BWBox,
        BWPanel,
        BWCopyright
    ],
    declarations: [
        BWTextInput,
        BWBox,
        BWPanel,
        BWCopyright
    ]
})

export class BWAuthComponentsModule {}