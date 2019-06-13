import { Meteor } from 'meteor/meteor';
import { Log } from '../logger';
import { moduleLoader } from './moduleloader';
import { BaseModuleInterface } from './base.module.interface';
const path = require('path');


const moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf("."));


class DirectUrlModule implements BaseModuleInterface {

    private _info: any = null;

    constructor (){
        this.loadSettings();
        if (!this._info.caption) { return; }
    }

    private loadSettings () {
        this._info = Meteor.settings.remotes[moduleId] || {};
        this._info = {
            moduleId: moduleId,
            refreshSessionInterval: 600,
            ...this._info
        };
    }

    getInfo () {
        return {
            moduleId: this._info.moduleId,
            caption: this._info.caption,
            protocol: this._info.protocol,
            type: this._info.type
        };
    }

    public getFile(fileUrl: any, userId?: any) {
        return { "url": fileUrl.href, 
                 "basename": path.basename(fileUrl.path),
                 "header": ""}
    }

}


Meteor.startup(() => {
    moduleLoader.addModule (new DirectUrlModule());
});