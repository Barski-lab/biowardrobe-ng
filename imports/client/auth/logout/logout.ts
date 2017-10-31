import { Component } from '@angular/core';
import { Router } from '@angular/router';


@Component({
    template: '<div></div>'
})
export class BWLogout {
    constructor(
        protected _router: Router
    ) {
        Meteor.logout(()=>{
            this._router.navigate(['/oauth/authorize']);
        });
    }
}