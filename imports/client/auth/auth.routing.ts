import { RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';

import { BWLogin }    from './login/login';
import { BWLogout }   from './logout/logout';
import { BWForgot }   from './forgot/forgot';
import { BWReset }   from './reset/reset';
import { BWLoggedIn } from './loggedin/loggedin';


export const AuthRouting: ModuleWithProviders = RouterModule.forRoot([
    { path: 'login', component: BWLogin },
    { path: 'oauth/authorize', component: BWLogin },
    { path: 'oauth/logout', component: BWLogout },
    { path: 'forgot', component: BWForgot},
    { path: 'reset', component: BWReset},
    { path: 'logout', component: BWLogout },
    { path: 'authorized', component: BWLoggedIn }
]);

// Why do we need two routes for the same component?
// Do we need the same for BWForgot and BWReset as well?