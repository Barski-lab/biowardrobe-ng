import { Meteor } from 'meteor/meteor';
import { BaseModuleInterface } from './base.module.interface';
import { moduleLoader } from './moduleloader';
import { Log } from '../logger';


class DummyModule implements BaseModuleInterface {
    info = {
        moduleId: "98765",
        caption: "Dummy-1",
        type: "files"
    };

    getFileList (params){
        return  [{
                    "_id": "root",
                    "name": "root",
                    "type": "folder",
                    "value": {},
                    "children": []
                }];
    }

    getFile (params){
        return "getFile called from DummyModule";
    }

    getInfo (){
        return this.info;
    }
}


Meteor.startup(() => {
    // var dummyModule = new DummyModule;
    // moduleLoader.addModule (dummyModule);
});