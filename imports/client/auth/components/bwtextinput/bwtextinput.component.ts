import { Component, Input, ViewChild, ElementRef } from '@angular/core';

import { BWInput } from '../../../lib';

@Component({
    selector: 'bw-textinput',
    templateUrl: './bwtextinput.html'
})

export class BWTextInput {
    @Input()
    bwControl: BWInput;
    @Input()
    image: string;

    @Input()
    focus: boolean = false;
    @Input()
    disabled: boolean = false;
    @Input()
    readonly: boolean = false;

    isInvalid() {
        return this.bwControl.valid == false && this.bwControl.dirty == true;
    }

    invalidMessage() {
        return this.bwControl.errors['message'];
    }

    @ViewChild('holder') _holder: ElementRef; // Why do we need this?
}
