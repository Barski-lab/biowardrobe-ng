import { Meteor } from 'meteor/meteor';

import { Log } from '../logger';
import { DDPConnection } from '../ddpconnection';


class ModuleLoader {
    private activeModules = {};
    public addModule (newModule){
        Log.debug("Load remote module", newModule.getInfo().caption, newModule.getInfo().moduleId);
        var self = this;
        this.activeModules[newModule.getInfo().moduleId] = newModule;

        DDPConnection.registerHook(newModule.getInfo().type,
            {
                'moduleId': newModule.getInfo().moduleId,
                'moduleFunction': (m):Promise<any> => {
                    return self.activeModules[m.moduleId][m.func](m.params);
                }
            }

        );
    }
}

export var moduleLoader = new ModuleLoader();
