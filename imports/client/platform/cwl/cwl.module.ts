import { NgModule, ModuleWithProviders } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { BWPlatformComponentsModule } from '../components/bwplatformcomponents.module'
import { BWCWLService } from './cwl.service';
import { BWUploadService } from './upload.service';
import { BWCWLForm } from './form/cwlform';

// Currently declarations and exports are empty till the moment I add other components
@NgModule({
    declarations: [
        BWCWLForm
    ],
    exports: [
        BWCWLForm
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        BWPlatformComponentsModule
    ]
})

// If we want to import module with all injected services, use CWLModule.forRoot()
// In case we need only components to be imported, we can avoid creating new instances of services, each time we import this
// module, by importing only CWLModule
export class CWLModule {
    static forRoot(): ModuleWithProviders {
        return {
            ngModule: CWLModule,
            providers: [BWCWLService, BWUploadService]
        }
    }
}