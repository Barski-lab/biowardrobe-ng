import { Component } from '@angular/core';
import template from './bwcopyright.html';

@Component({
    selector: 'bw-copyright',
    template
})
export class BWCopyright {

    get year(): number {
        return new Date().getFullYear();
    }
}