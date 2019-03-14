import { NgModule, ModuleWithProviders } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { BWPlatform } from './platform';
import { PlatformRouting } from './platform.routing';

import { BWDraftService } from '../lib'

import { BWPlatformComponentsModule } from './components/bwplatformcomponents.module'
import { SampleModule } from './sample/sample.module'
import { InvoiceModule } from './invoice/invoice.module'
import { CWLModule } from './cwl/cwl.module'


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
        BWPlatformComponentsModule,
        SampleModule.forRoot(),        // Note, we called with forRoot to include providers
        InvoiceModule.forRoot(),        // Note, we called with forRoot to include providers
        CWLModule.forRoot()            // Note, we called with forRoot to include providers
    ]
})
// If we want to import module with all injected services, use PlatformModule.forRoot()
// In case we need only components to be imported, we can avoid creating new instances of services, each time we import this
// module, by importing only PlatformModule
export class PlatformModule {
    static forRoot(): ModuleWithProviders {
        return {
            ngModule: PlatformModule,
            providers: [BWDraftService]
        }
    }
}