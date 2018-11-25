import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TooltipModule } from 'ngx-bootstrap';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app/app.component';
import { AppRouting } from './app.routing';

import { AuthModule } from '../auth/auth.module';
import { PlatformModule } from '../platform/platform.module'


// Call forRoot to import module with all its services (include providers).
// It's preferable to import module with services in the module, where we
// first need this service to be used. Note, after import this service
// becomes available globally in absolutely all modules.

@NgModule({
    imports: [
        CommonModule,
        BrowserModule,
        FormsModule,
        BrowserAnimationsModule,
        ReactiveFormsModule,
        RouterModule,
        TooltipModule,
        AppRouting,
        HttpModule,
        AuthModule.forRoot(),       // Note, we called forRoot() to import providers too
        PlatformModule.forRoot()    // Note, we called forRoot() to import providers too
    ],
    declarations: [AppComponent],
    bootstrap: [AppComponent]
})

export class AppModule {}

