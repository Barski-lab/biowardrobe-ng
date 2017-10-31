import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AuthRouting } from './auth.routing';
import { BWAuthComponentsModule } from './components/bwauthcomponents.module';
import { BWDirectivesModule } from '../lib';

import { BWLogin }    from './login/login';
import { BWLogout }   from './logout/logout';
import { BWLoggedIn }   from './loggedin/loggedin';


@NgModule({
    declarations: [
        BWLogin,
        BWLogout,
        BWLoggedIn
    ],
    exports: [
        BWLogin,
        BWLogout,
        BWLoggedIn
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        AuthRouting,
        BWAuthComponentsModule,
        BWDirectivesModule
    ]
})
export class AuthModule {}
