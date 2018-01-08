import { Component, Input } from '@angular/core';

import { BWControlComponentBase } from '../../lib';


@Component({
    selector: 'bw-textinput',
    template: `
        <mat-input-container class="full-width">
            <input matInput
                    [formControl]="bwControl"
                    [required]="bwControl?.required"
                    [readonly]="bwControl?.readonly||readonly"
                    [attr.focused]="bwControl?.focus"
                    [type]="bwControl?.type"
            >

            <mat-placeholder>
                <i *ngIf="!!image" class="{{image}}"></i>
                {{bwControl?.placeHolder||bwControl?.text||''}}
            </mat-placeholder>

            <ng-container matPrefix>
                <ng-content select="[matPrefix]"></ng-content>
            </ng-container>

            <ng-container matSuffix>
                <ng-content select="[matSuffix]"></ng-content>
            </ng-container>

            <mat-error *ngIf="isInvalid()">{{invalidMessage()}}</mat-error>
        </mat-input-container>
    `,
    styles:[`        
        .full-width {
            width: 100% !important;
        }
    `],
    host: {
        '[class.has-error]': 'isInvalid()'
    }
})

export class BWTextInput extends BWControlComponentBase {
    @Input()
    bwControl;

    @Input()
    image: string;

    @Input()
    readonly:boolean = false;

}
