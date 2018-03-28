import { NgModule, ModuleWithProviders } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { BWPlatformComponentsModule } from '../components/bwplatformcomponents.module'
import { CWLModule } from '../cwl/cwl.module'
import { BWSampleService } from './sample.service';
import { BWSampleEdit } from './edit/sampleedit'
import { BWSampleList } from './list/samplelist'


@NgModule({
    declarations: [
        BWSampleEdit,
        BWSampleList
    ],
    exports: [
        BWSampleEdit,
        BWSampleList
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        BWPlatformComponentsModule,
        CWLModule
    ]
})

// If we want to import module with all injected services, use SampleModule.forRoot()
// In case we need only components to be imported, we can avoid creating new instances of services, each time we import this
// module, by importing only SampleModule
export class SampleModule {
    static forRoot(): ModuleWithProviders {
        return {
            ngModule: SampleModule,
            providers: [BWSampleService]
        }
    }
}