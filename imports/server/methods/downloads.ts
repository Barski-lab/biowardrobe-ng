import { Meteor } from 'meteor/meteor';
import { Observable } from 'rxjs';

import { Log } from '../modules/logger';

const Aria2 = require("aria2");


// For testing:
// Listen only on localhost:6800, no encryion enabled, no secret token
// aria2c --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800

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
    downloadStart ()      { return Observable.fromEvent(this._ariaCli, "onDownloadStart") }
    downloadPause ()      { return Observable.fromEvent(this._ariaCli, "onDownloadPause") }
    downloadStop ()       { return Observable.fromEvent(this._ariaCli, "onDownloadStop") }
    downloadComplete ()   { return Observable.fromEvent(this._ariaCli, "onDownloadComplete") }
    downloadError ()      { return Observable.fromEvent(this._ariaCli, "onDownloadError") }
    btDownloadComplete () { return Observable.fromEvent(this._ariaCli, "onBtDownloadComplete") }
    
    openWebSocketConnection() {
        return Observable.fromPromise(this._ariaCli.open())
    }

    closeWebSocketConnection() {
        return Observable.fromPromise(this._ariaCli.close())
    }
    
    addUri(fileUri: any, fileDir: any, fileName: any, fileId: any) {
        Log.debug("Trying to download file from", fileUri, "to", fileDir, "with the name", fileName, "referenced by ID", fileId);
        return Observable.fromPromise(this._ariaCli.call("addUri", [fileUri], {"dir": fileDir, "out": fileName, "gid": fileId}))
    }
    
}

export const ariaDownload = new AriaDownload();

// Meteor.startup(() => {

//     var crypto = require("crypto");

//     let fileUri = "https://bootstrap.pypa.io/get-pip.py";
//     let fileDir = "/Users/kot4or/temp/del/temp";
//     let fileName = "get-pip-renamed.py";
//     var fileId = crypto.randomBytes(8).toString('hex');

//     ariaDownload.openWebSocketConnection()
//         .subscribe((res: any) => {Log.debug("Open WebSocket connection", res.target.url)},
//                    (err) => {Log.debug("Failed to open WebSocket connection", err)})

//     ariaDownload.addUri(fileUri, fileDir, fileName, fileId)
//         .subscribe((res) => {Log.debug("addUri fileId:", res)},
//                    (err) => {Log.debug("addUri error:", err)});

//     ariaDownload.downloadStart().subscribe((res) => {Log.debug("Start download:", res)})
//     ariaDownload.downloadComplete().subscribe((res) => {Log.debug("Complete download:", res)})
//     ariaDownload.downloadError().subscribe((res) => {Log.debug("Failed download:", res)})

// });