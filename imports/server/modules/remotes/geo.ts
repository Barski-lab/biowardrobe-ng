import { Meteor } from 'meteor/meteor';
import { Log } from '../logger';
import { moduleLoader } from './moduleloader';
import { BaseModuleInterface } from './base.module.interface';
import { Downloads } from '../../../collections/shared';


const path = require('path');


const moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf("."));


class GeoModule implements BaseModuleInterface {

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
            type: this._info.type,
            collection: "",                 // to pass check on the other side
            publication: ""                 // to pass check on the other side
        };
    }

    public getFile(fileUrl: any, userId?: any, sampleId?: any) {
        let url = fileUrl.href.replace("geo://", "").replace("/", "").replace(/,/g, " ").toUpperCase();
        let suffix = "";
        if (Downloads.findOne( {"sampleId": sampleId, "uri": url, "userId": userId})){
            suffix = "_2";
        }
        return { "url":      url,
                 "basename": url.replace(/ /g, "_").toLowerCase() + suffix + ".fastq.bz2",
                 "header": "geo"}
    }

}


Meteor.startup(() => {
    moduleLoader.addModule (new GeoModule());
});