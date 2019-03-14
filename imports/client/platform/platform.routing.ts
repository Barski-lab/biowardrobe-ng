import { ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';

import { BWPlatform } from './platform';

import { BWSampleEdit } from './sample/edit/sampleedit';
import { BWSampleList } from './sample/list/samplelist';

import { BWInvoiceEdit } from './invoice/edit/invoiceedit';
import { BWInvoiceList } from './invoice/list/invoicelist';

import { LoggedInGuard, LoggedInAdminGuard } from "../lib";


// Add LoggedInGuard to the routes that should be protected
export const PlatformRouting: ModuleWithProviders = RouterModule.forChild([
    {
        path: 'platform',
        component: BWPlatform,
        canActivate: [LoggedInGuard],
        children: [
            {path: 'samples', component: BWSampleList},
            {path: 'sample', component: BWSampleEdit},
            {path: 'invoices', component: BWInvoiceList, canActivate: [LoggedInAdminGuard]},
            {path: 'invoice', component: BWInvoiceEdit, canActivate: [LoggedInAdminGuard]},
        ]
    }
]);
