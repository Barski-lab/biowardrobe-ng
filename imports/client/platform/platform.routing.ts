import { ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';

import { BWPlatform } from './platform';
import { BWSampleEdit } from './sample/edit/sampleedit';
import { BWSampleList } from './sample/list/samplelist';


export const PlatformRouting: ModuleWithProviders = RouterModule.forChild([
    {
        path: 'platform',
        component: BWPlatform,
        children: [
            {path: 'sample', component: BWSampleEdit},
            {path: 'list', component: BWSampleList}
        ]
    }
]);
