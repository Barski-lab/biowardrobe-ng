import { RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';

import { BWLogin }    from './login/login';
import { BWLoggedIn } from './loggedin/loggedin';
import { LoggedInGuard } from '../lib';


export const AuthRouting: ModuleWithProviders = RouterModule.forChild([ // only gives the router components (doesn't provide again the services of forRoot)
    { path: 'login', component: BWLogin },
    { path: 'oauth/authorize', component: BWLogin },
    { path: 'authorized', component: BWLoggedIn, canActivate: [LoggedInGuard] },
    { path: '', redirectTo: '/login', pathMatch: 'full'}
]);
