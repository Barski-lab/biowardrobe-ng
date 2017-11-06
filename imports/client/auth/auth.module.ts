import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AuthRouting } from './auth.routing';
import { BWAuthComponentsModule } from './components/bwauthcomponents.module';
import { BWDirectivesModule } from '../lib';

import { AccountService } from '../lib/accounts.service'

import { BWLogin }    from './login/login';
import { BWLogout }   from './logout/logout';
import { BWForgot }   from './forgot/forgot';
import { BWReset }   from './reset/reset';
import { BWLoggedIn } from './loggedin/loggedin';


@NgModule({
    declarations: [
        BWLogin,
        BWLogout,
        BWLoggedIn,
        BWForgot,
        BWReset
    ],
    exports: [
        BWLogin,
        BWLogout,
        BWLoggedIn,
        BWForgot,
        BWReset
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        AuthRouting,
        BWAuthComponentsModule,
        BWDirectivesModule
    ],
    providers: [
        { provide: AccountService, useClass: AccountService }
    ]
})
export class AuthModule {}
