import { RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';

import { BWLogin }    from './login/login';
import { BWLogout }   from './logout/logout';
import { BWForgot }   from './forgot/forgot';
import { BWReset }   from './reset/reset';
import { BWLoggedIn } from './loggedin/loggedin';
import { BWEnroll } from './enroll/enroll';


export const AuthRouting: ModuleWithProviders = RouterModule.forChild([ // only gives the router components (doesn't provide again the services of forRoot)
    { path: 'login', component: BWLogin },
    { path: 'oauth/authorize', component: BWLogin },
    { path: 'oauth/logout', component: BWLogout },
    { path: 'forgot', component: BWForgot},
    { path: 'reset/:id', component: BWReset},
    { path: 'logout', component: BWLogout},
    { path: 'enroll/:id', component: BWEnroll},
    { path: 'authorized', component: BWLoggedIn },
    { path: '', redirectTo: '/login', pathMatch: 'full'}
]);
