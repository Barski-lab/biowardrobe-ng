import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { PlatformRouting } from './platform.routing';
import { BWPlatformComponentsModule } from '../platform/components/bwplatformcomponents.module'
import { BWPlatform } from './platform';


@NgModule({
    declarations: [
        BWPlatform
    ],
    exports: [
        BWPlatform
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        PlatformRouting,
        BWPlatformComponentsModule
    ]
})
export class PlatformModule {}
