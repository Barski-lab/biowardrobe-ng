import { Component, Input, ViewChild, ElementRef } from '@angular/core';

import { BWInput } from '../../../lib';
import template from './bwtextinput.html';

@Component({
    selector: 'bw-textinput',
    template
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
