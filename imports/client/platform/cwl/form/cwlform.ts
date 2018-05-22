import { Component, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';

import { BWComponentBase } from '../../../lib'
import { BWCWLService } from '../cwl.service'
import { BWUploadService } from '../upload.service'


@Component({
    selector: 'bw-cwlform',
    templateUrl: './cwlform.html'
})
export class BWCWLForm extends BWComponentBase {

    private activeTab: number = 0;
    private _allowUpload: boolean = false;
    private directories = [];
    // private directories = [
    //     {
    //         "name": "folder_1",
    //         "type": "folder",
    //         "path": "folder_1",
    //         "children": []
    //     },
    //     {
    //         "name": "folder_2",
    //         "type": "folder",
    //         "path": "folder_2",
    //         "children": [
    //             {
    //                 "name": "folder_2_1",
    //                 "type": "folder",
    //                 "path": "folder_2_1",
    //                 "children": [
    //                     {
    //                         "name": "folder_2_1_1",
    //                         "type": "folder",
    //                         "path": "folder_2_1_1",
    //                         "children": []
    //                     },
    //                     {
    //                         "name": "folder_2_1_2",
    //                         "type": "folder",
    //                         "path": "folder_2_1_2",
    //                         "children": [
    //                             {
    //                                 "name": "file_2_1_2_1",
    //                                 "type": "file",
    //                                 "path": "file_2_1_2_1",
    //                             }
    //                         ]
    //                     }
    //                 ]
    //             },
    //             {
    //                 "name": "folder_2_2",
    //                 "type": "folder",
    //                 "path": "folder_2_2",
    //                 "children": []
    //             }
    //         ]
    //     },
    //     {
    //         "name": "file_3",
    //         "type": "file",
    //         "path": "file_3",
    //         "children": []
    //     }
    // ];

    @Input("cwlData") set cwlData(value:any) {
        console.log ("Call cwlData");
        if(!value) return;
        console.log ("Get not empty cwlData", value);
        this.trackedId(this._cwlService.setCwlData(value).subscribe((v) => {    // TODO should I change it to this.tracked
            this.valueChanges.next(v)
        }),'cwlFormDataChanges');

        console.log ("Return valueChanges as cwlFormDataChanges event emitter");

        if(!this._cwlFormData) return;

        this._cwlService.updateFormGroupData(this._cwlFormData.metadata, this._cwlFormData.inputs);
        console.log ("updateFormGroupData with", this._cwlFormData.metadata, this._cwlFormData.inputs);
    }

    private _cwlFormData;
    @Input("cwlFormData") set cwlFormData(value:any) {
        console.log ("Call cwlFormData");
        if(!value) return;
        console.log ("Get not empty cwlFormData", value);
        this._cwlFormData = value;
        this._cwlService.updateFormGroupData(value.metadata, value.inputs);
        console.log ("updateFormGroupData with", value.metadata, value.inputs);
    }

    private _allowUpload: boolean = false;
    @Input("allowUpload") set allowUpload(value:any) {
        if(value == undefined) return;
        this._allowUpload = value;
    }

    private _inputFolder: string;
    @Input("inputFolder") set inputFolder(value:any) {
        if(value == undefined) return;
        this._inputFolder = value;
    }

    @Output()
    valueChanges = new Subject();

    constructor (
        private _cwlService: BWCWLService,
        private _uploadService: BWUploadService
    ) {
        super();
        this.tracked = this._uploadService.getFileStorageList()
            .subscribe((data) => {
                this.directories = _uploadService.makeDirectoriesFromFileList(data.files);
            });
    }

}
