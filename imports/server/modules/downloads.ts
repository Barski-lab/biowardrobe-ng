import { Meteor } from 'meteor/meteor';
import { Observable, Subject } from 'rxjs';
import { fromEvent } from 'rxjs/observable/fromEvent';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { tap, map, merge, mergeMap } from 'rxjs/operators';

import { Downloads, Samples } from '../../collections/shared';
import { moduleLoader } from './remotes/moduleloader';
import { Log } from './logger';

const aria2 = require("aria2");
const path = require("path");
const url = require('url');

// For testing:
// Listen only on localhost:6800, no encryion enabled, no secret token
// aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --rpc-listen-port=6800

class AriaDownload {

    private _aria: any;
    private _downloadQueue = {};

    private _nextToDownload$: Subject<any> = new Subject<any>();
    private _events$: Subject<any> = new Subject<any>();
    public get events$() {
        return this._events$;
    }

    private _openWebSocket(): Observable<any> {
        return fromPromise(this._aria.open())
    };

    private _downloadComplete(): Observable<any> {
        return fromEvent(this._aria, "onDownloadComplete").pipe(
            map( (r: any) => {
                return {"downloadId": r[0].gid}
            }))
    };

    private _downloadError(): Observable<any> {
        return fromEvent(this._aria, "onDownloadError").pipe(
            map( (r: any) => {
                return {"downloadId": r[0].gid, "error": "Download failed"}
            }))
    };

    private _addDownload(downloadUri: any, destinationPath: any, header: any): Observable<any> {
        return fromPromise(this._aria.call("addUri", [downloadUri], {"dir": path.dirname(destinationPath), "out": path.basename(destinationPath), "header": header}))
    }

    constructor() {
        let self = this;

        if (Meteor.settings.download && Meteor.settings.download["aria2"]) {

            self._aria = new aria2([Meteor.settings.download["aria2"]]);

            Downloads.find( {"downloaded": false, $or: [{"error": null}, {"error": ""}]} )
                .observeChanges({
                    added  (_id, data) { self._nextToDownload$.next( {_id, data} ) },
                    changed(_id, data) { self._nextToDownload$.next( {_id, data} ) }
                });

            self._openWebSocket()
                .pipe(
                    tap( (w: any) => Log.debug("Open WebSocket to", w.target.url) ),
                    mergeMap( () => self._nextToDownload$.asObservable() ),
                    tap( ({_id, data}) => Log.debug("Update Downloads collection", _id) ),
                    mergeMap( ({_id, data}) => self._addDownload(data.uri, data.path, data.header).pipe(
                                                    map( (downloadId: string) => {
                                                        data["_id"] = _id;
                                                        return {data, downloadId}}))),
                    tap( ({data, downloadId}) => Log.debug("Schedule new download with downloadId", downloadId) ))
                .subscribe(
                    ({data, downloadId}) => self._downloadQueue[downloadId] = data,
                    (err: any) => Log.error("Error encountered while scheduling new download", err))
                
            self._downloadComplete()
                .pipe(
                    merge(self._downloadError()))
                .subscribe(
                    Meteor.bindEnvironment( ({downloadId, error}) => error ? self._onDownloadError(downloadId) : self._onDownloadComplete(downloadId) ),
                    (err) => Log.error("Error encountered while processing results from scheduled download", err))

        }

    };

    public checkInputs(sampleId: string): boolean {
        let needDownload = false;
        let sample = Samples.findOne( {"_id": sampleId} );
        
        if (sample && sample["inputs"]) {
            const inputs = sample["inputs"];
            let destinationDirectory = inputs["output_folder"] || "/tmp";
            for (const key in inputs) {
                if (inputs[key] && inputs[key].class === 'File' && !inputs[key].location.startsWith("file://")) {
                    const fileUrl = url.parse(inputs[key].location);
                    const module = moduleLoader.getModule(fileUrl);
                    if (module){
                        const fileData = module.getFile(fileUrl, sample.userId);
                        if (!Downloads.findOne( {"sampleId": sampleId, "inputKey": key} )){
                            Downloads.insert({
                                "uri": fileData.url,                   
                                "path": path.resolve("/", destinationDirectory, fileData.basename),        
                                "header": fileData.header,
                                "sampleId": sampleId,
                                "inputKey": key,
                                "downloaded": false                                                 
                            });
                        }
                    }
                    needDownload = true;
                }
            }
        }
        return !needDownload;
    }

    private _onDownloadComplete (downloadId: string) {
        let doc = this._downloadQueue[downloadId];
        if (doc) {
            Log.debug("Success download", downloadId);
            Downloads.update( {"_id": doc._id}, {$set: {"downloaded": true}} );
            delete this._downloadQueue[downloadId];
            let updates = {};
            updates["inputs." + doc.inputKey + ".location"] = "file://" + doc.path;
            Samples.update({"_id": doc.sampleId}, {$set: updates});
            if (this.checkInputs(doc.sampleId)){
                this._events$.next( {"sampleId": doc.sampleId} );
            }
        }
    }
    
    private _onDownloadError (downloadId: string) {
        let doc = this._downloadQueue[downloadId];
        if (doc) {
            Log.debug("Failed download", downloadId);
            let errorMsg = "Failed to download " + doc.uri + ", downloadId: " + downloadId;
            Downloads.update({"_id": doc._id}, {$set: {"error": errorMsg}});
            delete this._downloadQueue[downloadId];
            this._events$.next( {"sampleId": doc.sampleId, "error": errorMsg} );
        }
    }

}

export const ariaDownload = new AriaDownload();