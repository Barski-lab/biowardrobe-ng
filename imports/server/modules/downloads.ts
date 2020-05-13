import { Meteor } from 'meteor/meteor';
import { Observable, Subject, fromEvent, of, from as observableFrom, merge, interval, Subscriber } from 'rxjs';
import { tap, map, mergeMap, catchError, filter, take } from 'rxjs/operators';

import { Downloads, Samples } from '../../collections/shared';
import { moduleLoader } from './remotes/moduleloader';
import { Log } from './logger';
import { AirflowProxy } from './airflow_proxy';

import { connection, DDPConnection } from './ddpconnection';
import { FilesUpload } from '../methods/filesupload';

import * as jwt from 'jsonwebtoken';
import * as mime from 'mime';
const path = require("path");
const url = require('url');
const aria2 = require('aria2');
const fs = require('fs');
const exec = require('child_process').exec;

// const bound = Meteor.bindEnvironment(callback => callback());
// For testing:
// Listen only on localhost:6800, no encryption enabled, no secret token
// aria2c --enable-rpc --rpc-listen-all=false --auto-file-renaming=false --auto-file-renaming=false --rpc-listen-port=6800 --rpc-secret="your secret token"

class AriaDownload {

    private _aria: any;
    // private _downloadQueue = {};

    private _nextToDownload$: Subject<any> = new Subject<any>();
    private _copyComplete$: Subject<any> = new Subject<any>();

    private _events$: Subject<any> = new Subject<any>();
    public get events$() {
        return this._events$;
    }

    /**
     *
     */
    constructor() {
        let self = this;

        if (Meteor.settings.download && Meteor.settings.download["aria2"]) {

            this._aria = new aria2([Meteor.settings.download["aria2"]]);

            // Downloads.find( {"downloaded": false, $or: [{"error": null}, {"error": ""}]} )
            //     .observeChanges({
            //         added  (_id, data) { self._nextToDownload$.next( {_id, data} ) },
            //         changed(_id, data) { self._nextToDownload$.next( {_id, data} ) }
            //     });

            this._openWebSocket()
                .pipe(
                    tap((w: any) => Log.debug("Open WebSocket to", w.target.url)),
                    mergeMap((v) => this._nextToDownload$),
                    tap(({ _id, data }) => Log.debug("Update Downloads collection", _id)),
                    mergeMap(({ _id, data }) =>
                        this._addDownload(data.uri, data.path, data.header, _id)
                            .pipe(
                                map((downloadId: string) => {
                                    // data["_id"] = _id;
                                    // self._downloadQueue[downloadId] = data;
                                    return { data, downloadId, _id }
                                }),
                                catchError((err) => Log.error("Failed to start download or copy status", err))
                            )
                    ),
                    mergeMap(({ data, downloadId, _id }) => {
                        return this._updateDownloadStatus(data.sampleId, { "title": "Download", "progress": 0 })
                            .pipe(
                                map((res: any) => {
                                    if (res.error && res.message) {
                                        Log.debug("Failed to submit downloading status", res.message);
                                    }
                                    return { data, downloadId }
                                }),
                                catchError((err) => Log.error("Failed to submit downloading status", err))
                            )
                    }
                    ),
                    catchError((err) => Log.error("Error encountered while scheduling new download", err))
                )
                .subscribe(({ data, downloadId }) => Log.debug("Schedule new download with downloadId", downloadId));

            /**
             * Any complete!
             */
            merge(this._downloadComplete(), this._downloadError(), this._copyComplete$).pipe(
                catchError((err) => Log.error("Error encountered while processing results from scheduled download", err))
            )
                .subscribe(
                    Meteor.bindEnvironment(({ downloadId, ariaId, error }) => {

                        downloadId = ariaId ? (Downloads.findOne({ downloadId: ariaId }) || {})._id : downloadId;

                        return error ? self._onDownloadError(downloadId) : self._onDownloadComplete(downloadId);
                    }));

            /**
             * Check aria2c download process
             */
            (new Observable(Meteor.bindEnvironment((observer: Subscriber<any>) => {
                Meteor.setInterval(() => {
                    observer.next();
                }, 3000);
            }))).pipe(
                mergeMap(() => {
                    const d: any = Downloads
                        .find({ "downloaded": false, "downloadId": { $exists: true }, "header": "" })
                        .fetch() || [null];
                    return of(...d);
                }),
                filter(_ => !!_),
                mergeMap((doc: any) => {
                    Log.debug("downloading", doc._id, doc.downloadId);
                    return observableFrom(this._aria.call("aria2.tellStatus", doc.downloadId)).pipe(
                        map((_status: any) => {
                            let { bitfield, ...status } = _status;
                            return { ...status, downloadId: doc.downloadId, sampleId: doc.sampleId, _id: doc._id };
                        }),
                        catchError((err) => Log.error("Aria2 process checker error:", err))
                    );
                }),
                mergeMap((status: any) => {

                    Log.debug("aria2 downloading status:", status);

                    if (status.status == "complete") {
                        this._copyComplete$.next({ "downloadId": status._id });
                        return of('finished');
                    }

                    if (status.completedLength && status.totalLength && status.totalLength != 0) {

                        return this._updateDownloadStatus(status.sampleId,
                            { "title": "Download", "progress": +(status.completedLength * 100.0 / status.totalLength).toFixed(2) })
                            .pipe(
                                map((res: any) => {
                                    if (res.error && res.message) {
                                        Log.debug("Failed to submit downloading status", res.message);
                                    }
                                    return { ...status }
                                }),
                                catchError((err) => Log.error("Failed to submit downloading status", err))
                            )
                    }
                    return of('processing');
                }),
                catchError((err) => Log.error("Aria2 process checker error:", err))
            )
                .subscribe((status: any) => {
                    Log.debug(status);
                });
        }
    }

    /**
     *
     * @private
     */
    private _openWebSocket(): Observable<any> {
        return observableFrom(this._aria.open());
    }

    /**
     *
     * @private
     */
    private _downloadComplete(): Observable<any> {

        return fromEvent(this._aria, "onDownloadComplete").pipe(
            map((r: any) => {
                return { ariaId: r[0].gid }
            }),
            catchError((err) => Log.error("Error encountered onDownloadComplete", err))
        )
    }

    /**
     *
     * @private
     */
    private _downloadError(): Observable<any> {
        return fromEvent(this._aria, "onDownloadError").pipe(
            map((r: any) => {
                return { error: 'download error', ariaId: r[0].gid }
            }),
            catchError((err) => Log.error("Error encountered onDownloadError", err))
        )
        return fromEvent(this._aria, "onDownloadError").pipe(
            map((r: any) => {
                const doc = Downloads.findOne({ "downloadId": r[0].gid });
                return { "downloadId": doc._id }
            }),
            catchError((err) => Log.error("Error encountered onDownloadError", err))
        )
    }

    /**
     *
     * @param downloadUri
     * @param destinationPath
     * @param downloadId
     * @private
     */
    private _copyLocalFile(downloadUri: any, destinationPath: any, downloadId: any) {
        Log.debug("copy file from", downloadUri, "to", destinationPath);
        try {
            fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        } catch (err) {
            Log.error('Failed to create directory', err);
        }
        fs.copyFile(downloadUri, destinationPath, fs.constants.COPYFILE_EXCL, (err: any) => {
            if (err) {
                Log.error('Failed to copy file', err);
                this._copyComplete$.next({ "downloadId": downloadId, "error": err });
            } else {
                this._copyComplete$.next({ "downloadId": downloadId });
            }
        });
    };

    /**
     *
     * @param downloadUri
     * @param destinationPath
     * @param downloadId
     * @private
     */
    private _downloadFromGeo(downloadUri: any, destinationPath: any, downloadId: any) {
        let dir = path.dirname(destinationPath);

        if (destinationPath.indexOf("_2.fastq.bz2") > -1) {
            Log.debug("Skip download. Already downloading from GEO", downloadUri, "to", dir);
            return;
        }

        Log.debug("Download file(s) from GEO", downloadUri, "to", dir);

        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
            Log.error('Failed to create directory', err);
        }

        let base = path.basename(destinationPath, ".fastq.bz2");
        let fastq_dump = `
            cd ${dir}
            for U in $(echo ${downloadUri})
            do
                fastq-dump --split-3 -B $\{U\}

                if [ $? -ne 0 ]; then
                  echo "Fastq-dump failure. Clean downloaded" >&2
                  rm -f "$\{U\}"*.fastq "${base}"*.fastq
                  exit 1
                fi

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

        exec(fastq_dump, Meteor.bindEnvironment((err: any, stdout: any, stderr: any) => {
            // Log.debug('Check download queue for paired end input data', this._downloadQueue);
            let doc = Downloads.findOne({ _id: downloadId });
            if (!doc) {
                Log.error(`Can't find ${downloadId} in downloads`);
                return;
            }

            // let paired_uri = doc.uri;
            // let paired_file = doc.path;
            // let paired_dir = path.dirname(paired_file);
            // paired_uri === downloadUri && paired_dir === dir && paired_file.indexOf("_2.fastq.bz2") > -1

            let paired_downloadId = Downloads.find({ uri: doc.uri, sampleId: doc.sampleId, "error": { $exists: false } })
                .fetch()
                .find(key => key._id != downloadId);

            // let paired_downloadId = Object.keys(this._downloadQueue).find(key => {
            //     let paired_uri = this._downloadQueue[key].uri;
            //     let paired_file = this._downloadQueue[key].path;
            //     let paired_dir = path.dirname(paired_file);
            //     return paired_uri === downloadUri && paired_dir === dir && paired_file.indexOf("_2.fastq.bz2") > -1
            // });

            if (err || stderr.indexOf("item not found") > -1) {
                Log.error('Failed to download file from GEO', stderr);
                this._copyComplete$.next({ "downloadId": downloadId, "error": stderr });
                if (paired_downloadId) {
                    this._copyComplete$.next({ "downloadId": paired_downloadId, "error": stderr });
                }
            } else {

                this._copyComplete$.next({ "downloadId": downloadId });
                if (paired_downloadId) {
                    this._copyComplete$.next({ "downloadId": paired_downloadId });
                }
            }
        }));
    }

    /**
     *
     * @param downloadUri
     * @param destinationPath
     * @param header
     * @param id
     * @private
     */
    private _addDownload(downloadUri: any, destinationPath: any, header: any, id?: any): Observable<any> {
        if (header == "geo") {
            this._downloadFromGeo(downloadUri, destinationPath, id);
            return of(id);
        }
        else if (header == "copy") {
            this._copyLocalFile(downloadUri, destinationPath, id);
            return of(id);
        } else {
            return observableFrom(this._aria.call("addUri", [downloadUri],
                {
                    "dir": path.dirname(destinationPath),
                    "out": path.basename(destinationPath),
                    "header": header
                })).pipe(
                    map((v: any) => {
                        Downloads.update({ "_id": id }, { $set: { "downloadId": v } });
                        return v;
                    })
                )
        }
    }

    private _updateDownloadStatus(sampleId: any, progress: any): Observable<any> {
        return AirflowProxy.master_progress_update(sampleId, { progress } as any)
    }

    public checkInputs(sampleId: string): boolean {
        Log.debug("Check inputs for sample", sampleId);
        let needDownload = false;
        let sample: any = Samples.findOne({ "_id": sampleId });

        if (sample && sample["inputs"]) {
            const inputs = sample["inputs"];
            for (const key in inputs) {
                if (inputs.hasOwnProperty(key) && inputs[key].location &&
                    !(inputs[key].location.startsWith("file://") || inputs[key].location.startsWith("/"))
                ) {

                    Log.debug("Process input", key, inputs[key].location);
                    const fileUrl = url.parse(inputs[key].location);
                    const module = moduleLoader.getModule(fileUrl);
                    if (!module) {
                        Log.error("Failed find module for protocol:", (fileUrl.protocol || "none").replace(":", ""));
                        return false;
                    }
                    Log.debug("Found module", module.getInfo().caption);
                    const fileData = module.getFile(fileUrl, sample.userId, sampleId);
                    Log.debug("fileData received from module", fileData);

                    let telegram: any;
                    let publicKey = connection.server_public_key;
                    let verifyOptions = {
                        algorithm: ["ES512"],
                        ignoreExpiration: true
                    };
                    try {
                        telegram = jwt.verify(inputs[key].token.replace("token://", ""), publicKey, verifyOptions);
                    } catch (err) {
                        Log.error("Failed to verify token", err);
                        return false;
                    }

                    Downloads.remove({ "downloaded": false, "error": { $exists: true } });

                    // Downloads.find( {"downloaded": false, $or: [{"error": null}, {"error": ""}]} )
                    //     .observeChanges({
                    //         added  (_id, data) { self._nextToDownload$.next( {_id, data} ) },
                    //         changed(_id, data) { self._nextToDownload$.next( {_id, data} ) }
                    //     });

                    if (telegram && !Downloads.findOne({ "sampleId": sampleId, "inputKey": key })) {
                        const data = {
                            "uri": fileData.url,
                            "path": AirflowProxy.output_folder(sample.projectId, sample._id) + `/${fileData.basename}`,
                            "header": fileData.header,
                            "sampleId": sampleId,
                            "projectId": telegram.projectId,
                            "userId": telegram.userId,
                            "fileId": telegram.fileId,
                            "inputKey": key,
                            "token": inputs[key].token.replace("token://", ""),
                            "downloaded": false
                        };
                        const _id = Downloads.insert(data);
                        data[_id] = _id;

                        this._nextToDownload$.next({ _id, data });
                    }
                    needDownload = true;
                }
            }
        }
        return !needDownload;
    }

    /**
     *
     * @param docId
     * @private
     */
    private _onDownloadComplete(docId: string) {
        const doc = Downloads.findOne({ _id: docId });
        if (!doc) {
            Log.debug(`Can't find downloadId: ${docId}`);
            return;
        }
        if (doc.downloaded != true) {
            Log.debug("Success download", docId);
            Downloads.update({ "_id": doc._id }, { $set: { "downloaded": true } });
            const opts = {
                meta: {
                    projectId: doc.projectId,
                    sampleId: doc.sampleId,
                    userId: doc.userId,
                    // synced: Date.now()/1000.0,
                    isOutput: false
                },
                fileName: path.basename(doc.path),
                userId: doc.userId,
                fileId: doc.fileId,
                type: mime.getType(doc.path)
            };

            FilesUpload.addFile(doc.path, opts, (err) => {
                if (err) {
                    Log.error("Failed to add file to FilesUpload collection", err);
                    Downloads.update({ "_id": doc._id }, { $set: { "error": err } });
                } else {
                    Downloads.update({ "_id": doc._id }, { $set: { "fileCollectionAdded": true } });

                    Samples.update({ "_id": doc.sampleId }, {
                        $set: {
                            [`inputs.${doc.inputKey}`]: {
                                "_id": doc.fileId,
                                "location": "file://" + doc.path,
                                "class": "File"
                            }
                        }
                    });
                    /**
                     * If last file downloaded for sample, notify subscribers that sample is ready to by analyzed
                     */
                    if (this.checkInputs(doc.sampleId)) {
                        this._events$.next({ "sampleId": doc.sampleId });
                    }
                }
            });
        } else {
            Log.debug(`Previously processed no attention needed: ${docId}`);
        }

        if (doc.masterSynced != true) {
            DDPConnection.call('satellite/file/uploaded', { token: doc.token, location: `file://${doc.path}` })
                .pipe(
                    take(1)
                )
                .subscribe(() => {
                    Downloads.update({ "_id": doc._id }, { $set: { "masterSynced": true } });
                    FilesUpload.collection.update({ _id: doc.fileId }, { $set: { "meta.synced": Date.now() / 1000.0 } });
                });
        }
    }

    /**
     *
     * @param docId
     * @private
     */
    private _onDownloadError(docId: string) {
        let doc = Downloads.findOne({ _id: docId });
        if (doc) {
            Log.error("Failed download: ", docId);
            let errorMsg = "Failed to download " + doc.uri;
            Downloads.update({ "_id": doc._id }, { $set: { "error": errorMsg } });
            // delete this._downloadQueue[downloadId];
            //Output, notify outside of the class
            this._events$.next({ "sampleId": doc.sampleId, "error": errorMsg });
            this._updateDownloadStatus(doc.sampleId, { "title": "Error", "progress": 0, "error": errorMsg })
                .pipe(
                    take(1)
                )
                .subscribe((res: any) => {
                    if (res.error && res.message) {
                        Log.debug("Failed to submit downloading status", res.message);
                    }
                });
        }
    }

}

export const ariaDownload = new AriaDownload();


Meteor.startup(() => {
    /**
     * Server startup
     */
    Downloads.remove({ "downloaded": false, "error": { $exists: true } });
    Downloads.remove({ "downloaded": false, "downloadId": { $exists: false } });
});
