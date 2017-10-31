import { ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';


export const AppRouting: ModuleWithProviders = RouterModule.forRoot([
    { path: '', redirectTo: '/login', pathMatch: 'full'},
    { path: '**', redirectTo: '/login' }
]);