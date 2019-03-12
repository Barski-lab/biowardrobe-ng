import { NgModule, ModuleWithProviders } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { BWPlatformComponentsModule } from '../components/bwplatformcomponents.module'

import { BWInvoiceService } from './invoice.service';
// import { BWInvoiceEdit } from './edit/invoiceedit'
import { BWInvoiceList } from './list/invoicelist'


@NgModule({
    declarations: [
        // BWInvoiceEdit,
        BWInvoiceList
    ],
    exports: [
        // BWInvoiceEdit,
        BWInvoiceList
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        BWPlatformComponentsModule
    ]
})


export class InvoiceModule {
    static forRoot(): ModuleWithProviders {
        return {
            ngModule: InvoiceModule,
            providers: [BWInvoiceService]
        }
    }
}

