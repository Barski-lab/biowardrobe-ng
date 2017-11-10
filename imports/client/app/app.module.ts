import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Ng2BootstrapModule } from 'ngx-bootstrap';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app/app.component';
import { AppRouting } from './app.routing';
import { AuthModule } from '../auth/auth.module';
import { BWPlatformComponentsModule } from '../platform/components/bwplatformcomponents.module'
import { PlatformModule } from '../platform/platform.module'


@NgModule({
    imports: [
        CommonModule,
        BrowserModule,
        FormsModule,
        BrowserAnimationsModule,
        ReactiveFormsModule,
        RouterModule,
        Ng2BootstrapModule,
        AppRouting,
        HttpModule,
        AuthModule,
        BWPlatformComponentsModule,
        PlatformModule
    ],
    declarations: [AppComponent],
    bootstrap: [AppComponent]
})

export class AppModule {}

