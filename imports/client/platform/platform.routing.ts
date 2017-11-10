import { ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';

import { BWPlatform } from './platform';


export const PlatformRouting: ModuleWithProviders = RouterModule.forRoot([
    { path: 'platform', component: BWPlatform }
]);
