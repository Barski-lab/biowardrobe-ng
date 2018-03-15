import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BWComponentBase } from '../../lib';

@Component({
    template: '<div></div>'
})
export class BWEnroll extends BWComponentBase {

    constructor(
        protected _router: Router,
        protected _route: ActivatedRoute
    ) {
        super();
        this._route.params.subscribe(
            params => {
                this._router.navigate(['/reset/' + params['id']], {replaceUrl:true} ); // replaceUrl - replace the current state in history
            }
        );
    }

}