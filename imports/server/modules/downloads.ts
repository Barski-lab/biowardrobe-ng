import { Meteor } from 'meteor/meteor';
import { Observable, Subject } from 'rxjs';
import { fromEvent } from 'rxjs/observable/fromEvent';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { tap, map, merge, mergeMap } from 'rxjs/operators';
import { of } from 'rxjs/observable/of';

import { Downloads, Samples } from '../../collections/shared';
import { moduleLoader } from './remotes/moduleloader';
import { Log } from './logger';
import { AirflowProxy } from './airflow_proxy';

import { connection, DDPConnection } from './ddpconnection';
import { FilesUpload } from '../methods/filesupload';

import * as jwt from 'jsonwebtoken';
import * as mime from 'mime';
const aria2 = require("aria2");
const path = require("path");
const url = require('url');
const fs = require('fs');
const exec = require('child_process').exec;

// For testing:
// Listen only on localhost:6800, no encryion enabled, no secret token
// aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --rpc-listen-port=6800 --rpc-secret="your secret token"

class AriaDownload {

    private _aria: any;
    private _downloadQueue = {};

    private _nextToDownload$: Subject<any> = new Subject<any>();
    private _waitForCopy$: Subject<any> = new Subject<any>();
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

    private _copyLocalFile(downloadUri: any, destinationPath: any, downloadId: any) {
        Log.debug("copy file from", downloadUri, "to", destinationPath);
        try {
            fs.mkdirSync(path.dirname(destinationPath), {recursive: true});
        } catch (err) {
            Log.error('Failed to create directory', err);
        }
        fs.copyFile(downloadUri, destinationPath, fs.constants.COPYFILE_EXCL, (err: any) => {
            if (err) {
                Log.error('Failed to copy file', err);
                this._waitForCopy$.next({"downloadId": downloadId, "error": err});
            } else {
                this._waitForCopy$.next({"downloadId": downloadId});
            }
        });
    };

    private _downloadFromGeo(downloadUri: any, destinationPath: any, downloadId: any) {
        let dir = path.dirname(destinationPath);
        
        if (destinationPath.indexOf("_2.fastq.bz2") > -1){
            Log.debug("Skip download. Already downloading from GEO", downloadUri, "to", dir);
            return;
        }
        
        Log.debug("Download file(s) from GEO", downloadUri, "to", dir);

        try {
            fs.mkdirSync(dir, {recursive: true});
        } catch (err) {
            Log.error('Failed to create directory', err);
        }

        let base = path.basename(destinationPath, ".fastq.bz2");
        let fastq_dump =`
            cd ${dir}
            for U in $(echo ${downloadUri}) 
            do
                fastq-dump --split-3 -B $\{U\}
            
                if [ -f $\{U\}_1.fastq ]; then
                mv -f "$\{U\}_1.fastq" "$\{U\}".fastq
                fi
            
                cat "$\{U\}.fastq" >> "${base}".fastq
                
                if [ -f "$\{U\}_2.fastq" ]; then
                cat "$\{U\}_2.fastq" >> "${base}"_2.fastq
                fi
                
                rm -f "$\{U\}.fastq"
                rm -f "$\{U\}_2.fastq"
            done
            bzip2 "${base}"*.fastq`;

        exec(fastq_dump, (err: any, stdout: any, stderr: any) => {
            // Log.debug('Check download queue for paired end input data', this._downloadQueue);
            let paired_downloadId = Object.keys(this._downloadQueue).find(key => {
                let paired_uri = this._downloadQueue[key].uri;
                let paired_file = this._downloadQueue[key].path;
                let paired_dir = path.dirname(paired_file);
                return paired_uri === downloadUri && paired_dir === dir && paired_file.indexOf("_2.fastq.bz2") > -1
            })
            if (err || stderr.indexOf("item not found") > -1) {
                Log.error('Failed to download file from GEO', stderr);
                this._waitForCopy$.next({"downloadId": downloadId, "error": stderr});
                if (paired_downloadId){
                    this._waitForCopy$.next({"downloadId": paired_downloadId, "error": stderr});
                }
            } else {
                this._waitForCopy$.next({"downloadId": downloadId});
                if (paired_downloadId){
                    this._waitForCopy$.next({"downloadId": paired_downloadId});
                }
            }
        });
    };

    private _addDownload(downloadUri: any, destinationPath: any, header: any): Observable<any> {
        if (header == "geo"){
            let downloadId = Random.id();
            this._downloadFromGeo(downloadUri, destinationPath, downloadId);
            return of(downloadId);
        }
        else if (header == "copy"){
            let downloadId = Random.id();
            this._copyLocalFile(downloadUri, destinationPath, downloadId);
            return of(downloadId);
        } else {
            return fromPromise(this._aria.call("addUri", [downloadUri], {"dir": path.dirname(destinationPath), "out": path.basename(destinationPath), "header": header}))
        }
    }

    private _updateDownloadStatus(sampleId: any, progress: any): Observable<any>{
        return AirflowProxy.master_progress_update(sampleId, {progress} as any)
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
                    mergeMap( ({_id, data}) => self._addDownload(data.uri, data.path, data.header)
                        .pipe(
                            map( (downloadId: string) => {
                                data["_id"] = _id;
                                return {data, downloadId}
                            }))),
                    mergeMap ( ({data, downloadId}) => this._updateDownloadStatus(data.sampleId, {"title": "Download", "progress": 0})
                        .pipe(
                            map( (res: any) => {
                                if (res.error && res.message){
                                    Log.debug("Failed to submit downloading status", res.message);
                                }
                                return {data, downloadId}
                            }))),
                    tap( ({data, downloadId}) => Log.debug("Schedule new download with downloadId", downloadId) ))
                .subscribe(
                    ({data, downloadId}) => self._downloadQueue[downloadId] = data,
                    (err: any) => Log.error("Error encountered while scheduling new download", err))
                
            self._downloadComplete()
                .pipe(
                    merge(self._downloadError()),
                    merge(self._waitForCopy$.asObservable()))
                .subscribe(
                    Meteor.bindEnvironment( ({downloadId, error}) => error ? self._onDownloadError(downloadId) : self._onDownloadComplete(downloadId) ),
                    (err) => Log.error("Error encountered while processing results from scheduled download", err))

        }

    };

    public checkInputs(sampleId: string): boolean {
        Log.debug("Check inputs for sample", sampleId);
        let needDownload = false;
        let sample: any = Samples.findOne( {"_id": sampleId} );
        
        if (sample && sample["inputs"]) {
            const inputs = sample["inputs"];
            for (const key in inputs) {
                if (inputs[key] && inputs[key].location && !(inputs[key].location.startsWith("file://") || inputs[key].location.startsWith("/"))) {
                    Log.debug("Process input", key, inputs[key].location);
                    const fileUrl = url.parse(inputs[key].location);
                    const module = moduleLoader.getModule(fileUrl);
                    if (!module){
                        Log.error("Failed find module for protocol:", (fileUrl.protocol||"none").replace(":",""));
                        return false;
                    }
                    Log.debug("Found module", module.getInfo().caption);
                    const fileData = module.getFile(fileUrl, sample.userId, sampleId);
                    Log.debug("fileData received from module", fileData);

                    let telegram: any;
                    let publicKey = connection.server_public_key;
                    let verifyOptions = {
                        algorithm: ["ES512"]
                    };
                    try {
                        telegram = jwt.verify(inputs[key].token.replace("token://", ""), publicKey, verifyOptions);
                    } catch (err) {
                        Log.error("Failed to verify token", err);
                        return false;
                    }
                    
                    if (telegram && !Downloads.findOne( {"sampleId": sampleId, "inputKey": key} )){
                        Downloads.insert({
                            "uri": fileData.url,
                            "path": AirflowProxy.output_folder(sample.projectId, sample._id)+`/${fileData.basename}`,
                            "header": fileData.header,
                            "sampleId": sampleId,
                            "projectId": telegram.projectId,
                            "userId": telegram.userId,
                            "fileId": telegram.fileId,
                            "inputKey": key,
                            "token": inputs[key].token.replace("token://", ""),
                            "downloaded": false
                        });
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
            DDPConnection.call('satellite/file/uploaded', {token: doc.token, location: `file://${doc.path}`})
                .subscribe(() => {
                    let opts = {
                        meta: {
                            projectId: doc.projectId,
                            sampleId: doc.sampleId,
                            userId: doc.userId,
                            synced: Date.now()/1000.0,
                            isOutput: false
                        },
                        fileName: path.basename(doc.path),
                        userId: doc.userId,
                        fileId: doc.fileId,
                        type: mime.getType(doc.path)
                    }
                    FilesUpload.addFile(doc.path, opts, (err) => {
                        if (err){
                            Log.error("Failed to add file to FilesUpload collection", err)
                        } else {
                            Samples.update({ "_id": doc.sampleId }, {
                                $set: {
                                    [`inputs.${doc.inputKey}`]: { "_id": doc.fileId, "location": "file://" + doc.path, "class": "File" }
                                }
                            });
                            if (this.checkInputs(doc.sampleId)){
                                this._events$.next( {"sampleId": doc.sampleId} );
                            }
                        }
                    });
                });
        }
    }
    
    private _onDownloadError (downloadId: string) {
        let doc = this._downloadQueue[downloadId];
        if (doc) {
            Log.error("Failed download", downloadId);
            let errorMsg = "Failed to download " + doc.uri + ", downloadId: " + downloadId;
            Downloads.update({"_id": doc._id}, {$set: {"error": errorMsg}});
            delete this._downloadQueue[downloadId];
            this._events$.next( {"sampleId": doc.sampleId, "error": errorMsg} );
            this._updateDownloadStatus(doc.sampleId, {"title": "Error", "progress": 0, "error": errorMsg})
                .subscribe( (res: any) => {
                    if (res.error && res.message){
                        Log.debug("Failed to submit downloading status", res.message);
                    }
                });
        }
    }

}

export const ariaDownload = new AriaDownload();
