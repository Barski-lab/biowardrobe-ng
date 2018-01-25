import { FormControl, Validators, FormArray, FormGroup, ValidatorFn, AsyncValidatorFn  } from '@angular/forms';

import { BWValidators } from './validators';

export * from './validators';

/*
 *
 */
export class BWInput extends FormControl {
    type: any;
    focus: boolean = false;
    disabled: boolean = false;
    public readonly: boolean = false;
    public placeHolder: string;

    constructor(
        public text,
        public required?:boolean,
        value?: any,
        validator?: ValidatorFn,
        asyncValidator?: AsyncValidatorFn)
    {
        super(value,validator,asyncValidator);

        var val = [];
        if(required)
            val.push(BWValidators.required);

        if(validator)
            val.push(validator);

        if(val.length >0)
            this.validator = Validators.compose(val);
    }
}

export class BWInputEmail extends BWInput {
    type = 'email';
    constructor(
        text:any,
        required?:boolean,
        value?: any,
        public verified?:boolean,
        public primary?:boolean
    )
    {
        super(text,required,value,BWValidators.email);
    }
}

export class BWInputText extends BWInput {
    type = 'text';
}

export class BWInputNumber extends BWInput {
    type = 'number';
}

export class BWInputCheckbox extends BWInput {
    type = 'checkbox';
    constructor(
        text:any,
        value?: any,
        public style?: string)
    {
        super(text,false,value);
    }
}


export class BWInputSpinnerText extends BWInput {
    type = 'text';
    constructor(
        text:any,
        required?:boolean,
        value?: any)
    {
        super(text,required,value,BWValidators.spinner);
    }

}

export class BWInputPassword extends BWInput {
    type = 'password';
    constructor(
        text:any,
        required?:boolean,
        value?: any)
    {
        super(text,required,value,BWValidators.password);
    }
}

export class BWInputImage extends BWInput {
    type = 'image';

    constructor(
        text:any,
        value?: any,
        public fileId?:any)
    {
        super(text,false,value);
    }
}

export class BWInputArray extends FormArray {
    type = 'array';

    constructor(
        public text,
        value: any,
        validator?: ValidatorFn,
        asyncValidator?: AsyncValidatorFn)
    {
        super(value,validator,asyncValidator);
    }
}

export class BWInputGroup extends FormGroup {
    type = 'group';

    constructor(
        public text,
        value: any,
        validator?: ValidatorFn,
        asyncValidator?: AsyncValidatorFn)
    {
        super(value,validator,asyncValidator);
    }
}

export const BW_CONTROLS:Array<any> = [ BWInput,
                                        BWInputEmail,
                                        BWInputText,
                                        BWInputNumber,
                                        BWInputCheckbox,
                                        BWInputSpinnerText,
                                        BWInputPassword,
                                        BWInputImage,
                                        BWInputArray,
                                        BWInputGroup];