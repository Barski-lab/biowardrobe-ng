import '../imports/client/polyfills';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Meteor } from 'meteor/meteor';

import { AppModule } from '../imports/client';

Meteor.startup(function(): void {
    if (Meteor.isProduction) {
        enableProdMode();
    }
    platformBrowserDynamic().bootstrapModule(AppModule).catch(err => console.error(err));
});
