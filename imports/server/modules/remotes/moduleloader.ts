import { Meteor } from 'meteor/meteor';

import { Log } from '../logger';
import { DDPConnection } from '../ddpconnection';


class ModuleLoader {
    private activeModules = {};
    public addModule (newModule){
        Log.debug("Load remote module", newModule.getInfo().caption, newModule.getInfo().moduleId, newModule.getInfo().protocol);
        var self = this;
        this.activeModules[newModule.getInfo().moduleId] = newModule;

        DDPConnection.registerHook(newModule.getInfo().type,
            {
                'moduleId': newModule.getInfo().moduleId,
                'info':newModule.getInfo(),
                'moduleFunction': (m):Promise<any> => {
                    return self.activeModules[m.moduleId][m.func](m.params);
                }
            }

        );
    }

    public getModule(fileUrl: any): any {
        let target_protocol = fileUrl.protocol.replace(":","");
        Log.debug("Searching for module by protocol", target_protocol);
        return Object.keys(this.activeModules)
            .map(key => this.activeModules[key])
            .find((m: any) => {
                if (Array.isArray(m.getInfo().protocol)){
                    return m.getInfo().protocol.includes(target_protocol);
                } else {
                    return m.getInfo().protocol == target_protocol;
                }
            });
    }

}

export var moduleLoader = new ModuleLoader();
