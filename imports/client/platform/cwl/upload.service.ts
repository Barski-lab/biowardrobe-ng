'use strict';

import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { FilesUpload, FileStorage } from '../../../collections/shared';
import { BWServiceBase } from '../../lib';

@Injectable()
export class BWUploadService extends BWServiceBase {

    public getFilesUploadCollection() {
        return FilesUpload;
    }

    public getFileStorageList():Observable<any> {
        if( FileStorage.findOne( {'userId': Meteor.userId()} ) ) {
            return Observable.of(FileStorage.findOne( {'userId': Meteor.userId()} ));
        } else
            return this.MeteorSubscribeAutorun("filestorage/get", () => {
                return FileStorage.findOne( {'userId': Meteor.userId()} )
            });
    }

    public makeDirectoriesFromFileList(fileList){
        let directories = [];
        fileList.forEach((item)=>{
            directories.push({
                "name": item,
                "type": "file",
                "path": item,
                "children": []
            })
        });
        return directories;
    }

}

