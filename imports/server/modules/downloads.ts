import { Meteor } from 'meteor/meteor';
import { Observable } from 'rxjs';

import { Downloads, Samples } from '../../collections/shared';
import { connection } from './ddpconnection';
import { Log } from './logger';

const Aria2 = require("aria2");
const path = require("path");
const fs = require("fs");

// For testing:
// Listen only on localhost:6800, no encryion enabled, no secret token
// aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --rpc-listen-port=6800

export function allInputsExits(sampleId: string) {
    let destinationDirectory = "/Users/kot4or/temp/del/temp";  // Should be set based on sampleId 
    let needDownload = false;
    let sample = Samples.findOne({"_id": sampleId});
    
    if (sample && sample["inputs"]) {
        const inputs = sample["inputs"];
        for (const key in inputs) {
            if (inputs[key] && inputs[key].class === 'File' ) {
                let location = inputs[key].location;
                if (!location.startsWith("file://")){
                    let activeDownload = Downloads.findOne({"sampleId": sampleId, "inputKey": key});
                    if (!activeDownload){
                        Downloads.insert({
                            "uri": inputs[key].location,                   
                            "path": path.resolve("/", destinationDirectory, inputs[key].location.split("/").slice(-1)[0]),        
                            "sampleId": sampleId,
                            "inputKey": key,
                            "downloaded": false                                                 
                        });
                    }
                    needDownload = true;
                } else if (!fs.existsSync(location.replace('file://',''))) {
                    throw new Error(`Missing local file ${location}`);
                }
            }
        }
    }
    return !needDownload;
}


function onAddDownloads (id: string, doc: any) {
    ariaDownload.addUri(doc.uri, doc.path)
        .subscribe(
            (gid: string) => {
                doc["_id"] = id;
                downloadList[gid] = doc;
                Log.debug("Schedule download for the file", doc.fileId, "from", doc.uri, "with download ID", gid)
            },
            (err) => {
                Log.debug("Failed to schedule download for the file", doc.fileId, "from", doc.uri, "\n", err)
            });
}


function onDownloadComplete (downloadId: string) {
    let doc = downloadList[downloadId];
    if (doc) {
        Log.debug("Found completed download\n", doc);
        Downloads.update({"_id": doc._id}, {$set: {"downloaded": true}});
        delete downloadList[downloadId];

        let updates = {};
        updates["inputs." + doc.inputKey + ".location"] = "file://" + doc.path;
        Samples.update({"_id": doc.sampleId}, {$set: updates});

        connection.setEvent({name: "samples", event: 'changed', id: doc.sampleId});
    }
}


function onDownloadError (downloadId: string) {
    let doc = downloadList[downloadId];
    if (doc) {
        Log.debug("Found failed download\n", doc);
        Downloads.update({"_id": doc._id}, {$set: {error: "Failed to download"}});
        delete downloadList[downloadId];
    }
}


class AriaDownload {

    private _ariaCli: any;
    private _default = {
        host: 'localhost',
        port: 6800,
        secure: false,
        secret: '',
        path: '/jsonrpc'
    };

    constructor(settings?: any) {
        this._ariaCli = new Aria2([settings || (!!Meteor.settings.download && Meteor.settings.download["aria2"]) || this._default]);
    };

    /**
     * The JSON-RPC interface does not support notifications over HTTP,
     * but the RPC server will send notifications over WebSocket.
     * So use openWebSocketConnection() if you want to reveive notifications
     */
    downloadStart ()      { return Observable.fromEvent(this._ariaCli, "onDownloadStart") }       // return array, why?
    downloadPause ()      { return Observable.fromEvent(this._ariaCli, "onDownloadPause") }       // return array, why?
    downloadStop ()       { return Observable.fromEvent(this._ariaCli, "onDownloadStop") }        // return array, why?
    downloadComplete ()   { return Observable.fromEvent(this._ariaCli, "onDownloadComplete") }    // return array, why?
    downloadError ()      { return Observable.fromEvent(this._ariaCli, "onDownloadError") }       // return array, why?
    btDownloadComplete () { return Observable.fromEvent(this._ariaCli, "onBtDownloadComplete") }  // return array, why?
    
    openWebSocketConnection() {
        return Observable.fromPromise(this._ariaCli.open())
    }

    closeWebSocketConnection() {
        return Observable.fromPromise(this._ariaCli.close())
    }
    
    addUri(downloadUri: any, destinationPath: any) {
        Log.debug("Trying to download file from", downloadUri, "to", destinationPath);
        return Observable.fromPromise(this._ariaCli.call("addUri", [downloadUri], {"dir": path.dirname(destinationPath), "out": path.basename(destinationPath)}))
    }
    
}


let downloadList = {}
let ariaDownload = null;


Meteor.startup(() => {

    if (Meteor.settings.download && Meteor.settings.download["aria2"]) {
        ariaDownload = new AriaDownload();
        ariaDownload.openWebSocketConnection().subscribe(
            (res: any) => {
                Log.debug("Open WebSocket connection", res.target.url);
                Downloads.find({"downloaded": false, $or: [{"error": null}, {"error": ""}]}).observeChanges({added: onAddDownloads, changed: onAddDownloads});
                ariaDownload.downloadComplete().subscribe(Meteor.bindEnvironment((res: any) => onDownloadComplete(res[0].gid)));
                ariaDownload.downloadError().subscribe(Meteor.bindEnvironment((res: any) => onDownloadError(res[0].gid)));
            },
            (err: any) => {
                Log.debug("Failed to open WebSocket connection\n", err)
            }
        )
    }

});