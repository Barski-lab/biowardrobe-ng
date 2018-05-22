import { Component, Input } from '@angular/core';

@Component({
    selector: 'bw-box',
    templateUrl: './bwbox.html'
})
export class BWBox {
    @Input() title:string;
    @Input() subtitle:string;
    @Input() alert:boolean;
}
