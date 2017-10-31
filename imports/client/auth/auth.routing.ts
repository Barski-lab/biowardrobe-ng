import { RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';

import { BWLogin }    from './login/login';
import { BWLogout }   from './logout/logout';
import { BWLoggedIn } from './loggedin/loggedin';


export const AuthRouting: ModuleWithProviders = RouterModule.forChild([ // Or RouterModule.forChild
    { path: 'login', component: BWLogin },
    { path: 'oauth/authorize', component: BWLogin },
    { path: 'oauth/logout', component: BWLogout },
    { path: 'logout', component: BWLogout },
    { path: 'authorized', component: BWLoggedIn },
    { path: '', redirectTo: '/login', pathMatch: 'full'},
    { path: '**', redirectTo: '/login' }
]);

