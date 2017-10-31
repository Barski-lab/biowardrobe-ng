import { Component, Input } from '@angular/core';
import template from './bwbox.html';

@Component({
    selector: 'bw-box',
    template
})
export class BWBox {
    @Input() title:string;
    @Input() subtitle:string;
    @Input() alert:boolean;
}
