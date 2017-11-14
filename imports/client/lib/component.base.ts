import { Meteor } from 'meteor/meteor';
import { FormControl, FormGroup } from '@angular/forms';

import { BWTracking } from './tracking'

export class BWComponentBase extends BWTracking {
    id = Random.id();

    protected submitting: boolean = false;
    protected showError: boolean = false;

    constructor () {
        super();
    }

    public isInvalid(comp):boolean {
        if(comp && comp instanceof FormControl && comp.errors )
            return this.showError && !!comp.errors;
        if(comp && comp instanceof FormGroup)
            return this.showError && !comp.valid;
        return false;
    }

    checkSubmit():boolean {
        this.submitting = true;
        let status = Meteor.status();
        if(!status['connected']) {
            this.submitting = false;
            console.log({   title: 'Can\'t connect to the server.', type: 'error', text: status.reason,  timer: 3000 });
        }
        return this.submitting;
    }


}
