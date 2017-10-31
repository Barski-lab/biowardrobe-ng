import { Log } from '../logger';


export interface BaseModuleInterface {
    getInfo (): {
        moduleId: string,
        caption: string,
        type: string
    };
}