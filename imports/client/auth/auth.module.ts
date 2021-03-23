import { NgModule, ModuleWithProviders } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AuthRouting } from './auth.routing';
import { BWAuthComponentsModule } from './components/bwauthcomponents.module';
import { BWDirectivesModule, BWAccountService, LoggedInGuard, LoggedInAdminGuard } from '../lib';

import { BWLogin }    from './login/login';
import { BWLoggedIn } from './loggedin/loggedin';


@NgModule({
    declarations: [
        BWLogin,
        BWLoggedIn
    ],
    exports: [
        BWLogin,
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

// If we want to import module with all injected services, use AuthModule.forRoot()
// In case we need only components to be imported, we can avoid creating new instances of services, each time we import this
// module, by importing only AuthModule
export class AuthModule {
    static forRoot(): ModuleWithProviders {
        return {
            ngModule: AuthModule,
            providers: [BWAccountService, LoggedInGuard, LoggedInAdminGuard]
        }
    }
}