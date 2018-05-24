import {Component, NgZone} from '@angular/core';
import { Router } from '@angular/router';


@Component({
    template: '<div></div>'
})
export class BWLogout {
    constructor(
        protected _router: Router,
        protected _zone: NgZone
    ) {
        Meteor.logout(() => {
            this._zone.run(() => {
                this._router.navigate(['/']);
            });
        });
    }
}