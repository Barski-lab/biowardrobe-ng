import { FormControl, FormGroup } from '@angular/forms';

export class BWAuthBase {

    public submitting: boolean = false;
    public showError: boolean = false;

    constructor () {}

    public isInvalid(comp):boolean {
        if(comp && comp instanceof FormControl && comp.errors )
            return this.showError && !!comp.errors;
        if(comp && comp instanceof FormGroup)
            return this.showError && !comp.valid;
        return false;
    }

}
