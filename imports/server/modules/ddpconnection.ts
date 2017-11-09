import { DDP } from 'meteor/ddp';
import { Mongo } from 'meteor/mongo';
import { Log } from './logger';


export class DDPConnection {
    private static DDPConnection:DDP.DDPStatic = null;
    private static _hooks = {};
    private static _messages = {active: [], backup : []};

    private _satelite_ch;

    private satellitesubscription;

    private static chan_id;

    constructor() {
        if(Meteor.settings['rc_server']) {
            this._do_connect();
            Meteor.setInterval(this.sendMessages, 3000);
        }
    }

    private sendMessages () {
        if (DDPConnection.chan_id && DDPConnection._messages.active.length > 0 ){
            while (DDPConnection._messages.active.length) {
                let msg = DDPConnection._messages.active.pop();
                DDPConnection.DDPConnection.call('add/remotemodule', Meteor.settings['rc_server_token'], msg,
                    (err, res) => {
                        if (err) {
                            // Log.error("Can't send message \n", msg, err);
                            DDPConnection._messages.active.push (msg);
                        }
                    }
                );
            }
        }
    }

    public static addMessage (newMsg){
        DDPConnection._messages.active.push (newMsg);
        DDPConnection._messages.backup.push (newMsg);
    }

    private restoreBackupMessages (){
        Log.debug("Restore satellite messages from backup to resend to server after reconnect");
        DDPConnection._messages.active = [];
        DDPConnection._messages.backup.forEach(backUpMsg => {
            DDPConnection._messages.active.push(backUpMsg)
        });
    }

    private _do_connect(){
        if(!DDPConnection.DDPConnection) {
            DDPConnection.DDPConnection = DDP.connect(Meteor.settings.rc_server);
            Log.debug ("Setting DDP connection to", Meteor.settings.rc_server);
            this._satelite_ch = new Mongo.Collection("satellite", { connection: DDPConnection.DDPConnection });
            this._satelite_ch.find().observe({
                added: (a) => {
                    Log.debug('Added:\n', a);
                    this._check_recieve(a, "added");
                },
                changed: (a) => {
                    Log.debug('Changed:\n', a);
                    this._check_recieve(a,"changed");
                },
                removed: (a) => {
                    Log.debug('Removed:\n', a);
                },
            });
        }
        DDPConnection.DDPConnection.onReconnect = () => {
            Log.info("Reconnecting");
            DDPConnection.chan_id = null;
            this.restoreBackupMessages();
        };

        this._do_init();
    }

    private _do_init() {
        if(this.satellitesubscription)
            this.satellitesubscription.stop();

        this.satellitesubscription = DDPConnection.DDPConnection.subscribe("satellite", Meteor.settings.rc_server_token, {
            onStop: (a) => {
                Log.info("Subscribe stop:", a);
                DDPConnection.chan_id = null;
                // DDPConnection.DDPConnection.reconnect();
            },
            onReady: () => {
            }
        });
    }

    private _check_recieve(a, type){ //type: added, changed...

        if( a.subscribed && a._id ) {
            DDPConnection.chan_id = a._id;
            Log.debug("New satellite is connected:", a);
            return;
        }

        Log.info("Recieve:\n", type, a);

        var request = a.request;

        if( DDPConnection.chan_id && a._id && request.files ) { //files
            Log.debug("Files:\n", request);
            try {
                this.processFiles (request, a);
            } catch(e){}
        }
    }

    /**
     * @Deprecated
     * @param request
     * @param a
     */
    public processFiles (request, a){
        Log.debug("processFiles is called");
        var targetModule = _.find (DDPConnection._hooks["files"], remoteModule => {return remoteModule.moduleId == request.moduleId});
        if (targetModule == null){
            return;
        }
        Log.debug("processFiles target module", targetModule);
        var message = targetModule.moduleFunction(request);
        if(DDPConnection.chan_id && message) {
            message.then((m)=> {
                    DDPConnection.DDPConnection.call("remote/module/data", a._id, m);
                    Log.debug("Success files:\n", a._id, m);
                }, (e)=> {
                    DDPConnection.DDPConnection.call("remote/module/data", a._id, {"error": e});
                    Log.debug("Fail files:\n", a._id, e);
                }
            )
        }
    }


    /**
     * Check if it works
     * @param {{type: String; moduleId: String; func: String; params: any}} request
     * @returns {Promise<any>}
     */
    public callModuleFunc (request: {type: String, moduleId: String, func: String, params: any}){
        try {
            var targetModule = _.find (DDPConnection._hooks[request.type], remoteModule => {return remoteModule.moduleId == request.moduleId});
            let promiseFunction = targetModule.moduleFunction(request);
        } catch (err){
            throw new Meteor.Error("Module or target function is not found", err);
        }
        return promiseFunction;
    }


    public static registerHook(n,h){
        if(!DDPConnection._hooks[n])
            DDPConnection._hooks[n]=[];

        // if(typeof h === "function") // Should allow Objects too, because of file
        {
            Log.debug("Register Hook type", n);
            DDPConnection._hooks[n].push(h);
        }
    }

    public get connection(){
        return DDPConnection.DDPConnection;
    }
}

export var connection = new DDPConnection();

