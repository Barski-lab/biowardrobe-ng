//http://stackoverflow.com/questions/34502768/why-angular2-template-local-variables-are-not-usable-in-templates-when-using-ng/34503163#34503163

import { NgModule, Directive, ElementRef, Input } from '@angular/core';

@Directive({
    selector: '[bwFocus]'
})
export class BWFocus {
    @Input('bwFocus') hasFocus: boolean;
    constructor(private el: ElementRef) {}

    ngAfterViewInit() {
        if(this.hasFocus)
            this.el.nativeElement.focus();
    }
    ngOnChanges(changes) {
        if(changes.hasFocus.currentValue == true) {
            this.el.nativeElement.focus();
        }
    }
}

@Directive({
    selector: '[bwDisabled]',
})
export class BWDisabled {
    @Input('bwDisabled') isDisabled: boolean;

    constructor(private el: ElementRef) {}

    @Input() set BWDisabled(condition: boolean) {
        if (condition) {
            this.el.nativeElement.setAttribute('disabled','disabled');
        } else {
            this.el.nativeElement.removeAttribute('disabled');
        }
    }
}

@Directive({
    selector: '[bwReadOnly]',
})
export class BWReadOnly {
    @Input('bwReadOnly') isDisabled: boolean;

    constructor(private el: ElementRef) {}

    @Input() set BWReadOnly(condition: boolean) {
        if (condition) {
            this.el.nativeElement.setAttribute('readonly','readonly');
        } else {
            this.el.nativeElement.removeAttribute('readonly');
        }
    }
}


@NgModule({
    declarations: [
        BWFocus,
        BWReadOnly,
        BWDisabled
    ],
    exports: [
        BWFocus,
        BWReadOnly,
        BWDisabled
    ]
})

export class BWDirectivesModule {}