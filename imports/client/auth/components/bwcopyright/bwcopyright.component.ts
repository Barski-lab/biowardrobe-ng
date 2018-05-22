import { Component } from '@angular/core';

@Component({
    selector: 'bw-copyright',
    templateUrl: './bwcopyright.html'
})
export class BWCopyright {

    get year(): number {
        return new Date().getFullYear();
    }
}