import { HTTP } from 'meteor/http';
import { Meteor } from 'meteor/meteor';

import { DDPConnection, connection } from './ddpconnection';

import {
    catchError,
    switchMap,
    map,
    filter,
    tap,
    mergeMap,
    delay, concatMap
} from 'rxjs/operators';
import { Observable, Subscriber, Subject } from 'rxjs';
import { bindNodeCallback } from 'rxjs/observable/bindNodeCallback';
import { of } from 'rxjs/observable/of';

import { FileData, FileObj, FilesCollection } from 'meteor/ostrio:files';
import { FilesUpload, FileUploadCollection } from '../methods/filesupload';

import { WorkflowsGitFetcher } from '../methods/git';

import { CWLCollection, Samples, airflowQueueCollection } from '../../collections/shared';
import { ariaDownload } from './downloads'
import { Log } from './logger';

import * as path from 'path';
import * as mime from 'mime';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as zlib from 'zlib';

let pdelay = (data, delay) => {
    return Observable.create(Meteor.bindEnvironment((observer: Subscriber<any>) => {
        Meteor.setTimeout(() => {
            observer.next(data);
            observer.complete();
        }, delay);
    }));
};

export class AirflowProxy {

    private app:any = undefined;
    private routes = undefined;

    private static listen$: Subject<any> = new Subject();

    constructor () {
        this.initRoutes ();

        AirflowProxy.listen$
            .pipe(
                filter(({dag_id, run_id, results}) => dag_id === 'clean_dag_run'),
                concatMap((d: any) => pdelay(d, 2000)),
                switchMap(({dag_id, run_id, results}) => {
                    Log.debug(`Successfully cleaned! ${run_id}`);
                    //FIXME: probably memory leak, replace with stream of dags to clean
                    return AirflowProxy.trigger_dag(run_id)
                        .pipe(
                            switchMap(({result, error, message, sample}) => {
                                let progress: any = null;
                                if (error) {
                                    Log.error("AirflowProxy.trigger_dag:", message);
                                    progress = {
                                        title: "Error",
                                        progress: 0,
                                        error: message
                                    }
                                } else if (result) {
                                    Log.debug("AirflowProxy.trigger_dag:", result);
                                    progress = {
                                        title: "Queued",
                                        progress: 0
                                    }
                                }
                                if (progress && sample) {
                                    return AirflowProxy.master_progress_update(sample._id, {progress} as any)
                                } else {
                                    return of({error: true, message: `No sample ${progress}`});
                                }
                            }),
                            catchError((e) => of({error: true, message: `Error: ${e}`}))
                        )

                })
            ).subscribe((r: any) => r && r.error ? Log.error(r) : Log.debug(r) );
    }

    /**
     * Display debug data for middleware
     * @param req
     * @param res
     * @param next
     */
    private debugMiddle(req, res, next) {
        Log.debug('[Airflow Proxy]:', req.method, req.url, req.body, req.user);
        return next();
    }

    /**
     *
     */
    private initRoutes() {
        let self = this;
        this.app = express();
        this.routes = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        this.app.post('/progress', this.debugMiddle, Meteor.bindEnvironment(self.listen_progress));
        this.app.post('/results', this.debugMiddle, Meteor.bindEnvironment(self.listen_results));
        this.app.use(this.routes);
        WebApp.connectHandlers.use('/airflow', this.app);
    }

    /**
     * Returns airflow API url for a dag
     * @param dag_id
     */
    private static dag_url (dag_id): string {

        if (!Meteor.settings["airflow"] || !Meteor.settings["airflow"]["trigger_dag"]) {
            throw new Error(`no airflow settings`);
        }

        return Meteor.settings["airflow"]["trigger_dag"].replace("{dag_id}", dag_id);
    }

    /**
     *
     * @param dag_id
     * @param data
     * @param sample
     */
    private static airflow_post(dag_id, data, sample): Observable<{result?, error?, message?, sample?}> {

        Log.debug("Let's trigger a workflow:", AirflowProxy.dag_url(dag_id), data);

        return bindNodeCallback(HTTP.post)(
            AirflowProxy.dag_url(dag_id),
            {
                data,
                timeout: 60000
            })
            .pipe(
                map((result) => ({result, sample})),
                catchError((e) => {
                    Log.error('airflow_post error:', e);
                    return of({ error: true, message: `Airflow POST: ${e}`, sample: sample });
                })
            );
    }

    /**
     *
     * @param sample_id
     */
    public cleanup_dag(sample_id): Observable<any> {

        if (!Meteor.settings["airflow"] || !Meteor.settings["airflow"]["trigger_dag"]) {
            return of({ error: true, message: `no airflow settings`});
        }

        let sample: any = Samples.findOne({_id: sample_id});
        if (!sample) {
            Log.error("No sample:", sample_id);
            return of({ error: true, message: `no sample id ${sample_id}`});
        }

        if (sample.projectId == 'Mrx3c92PKkipTBMsA') {
            Log.debug("Project is not for analysis yet", sample_id);
            return of({ error: true, message: `Project is not for analysis yet ${sample_id}`});
        }

        let cwl: any = CWLCollection.findOne({_id: sample.cwlId});
        if (!cwl) {
            Log.error("No cwl", sample.cwlId);
            return of({ error: true, message: `no cwl ${sample.cwlId}`, sample: sample });
        }

        let dag_id = `${cwl._id}-${cwl.git.sha}`; // path.basename(cwl.git.path, ".cwl");

        let packed = JSON.parse(zlib.gunzipSync(Buffer.from(cwl.source.packed, 'base64')).toString());
        WorkflowsGitFetcher.exportWorkflow(Meteor.settings["airflow"]["dags_folder"], dag_id, packed);

        let queue = airflowQueueCollection.findOne({sample_id});
        if (queue) {
            return of({ warning: true, message: `Not yet cleaned`, sample: sample });
        }

        let queue_id = airflowQueueCollection.insert({sample_id});
        let remove_dag_id = sample["dag_id"] || dag_id;
        Samples.update({"_id": sample_id}, {$unset: {"dag_id": ""}});

        const data = {run_id: queue_id, conf: JSON.stringify({remove_dag_id: remove_dag_id, remove_run_id: sample_id}) };

        return AirflowProxy.airflow_post('clean_dag_run', data, sample);
    }

    /**
     * Triggers Airflow's DAG by queue id,
     * It deletes files that are marked as isOutput in filecollection
     * Finds sample and corresponding CWL (FIXME: airflow has to kill by run_id)
     *
     * @param queue_id
     */
    public static trigger_dag(queue_id): Observable<any> {
        Log.debug('Trigger dag:', queue_id);

        if (!Meteor.settings["airflow"] || !Meteor.settings["airflow"]["trigger_dag"]) {
            return of({ error: true, message: `no airflow settings`});
        }

        let queue: any = airflowQueueCollection.findOne({_id: queue_id});
        if (!queue) {
            return of({ error: true, message: `No queue for ${queue_id}`});
        }
        let {sample_id} = queue;
        airflowQueueCollection.remove(queue_id);

        let sample: any = Samples.findOne({_id: sample_id});
        if (!sample) {
            Log.error("No sample:", sample_id);
            return of({ error: true, message: `no sample id ${sample_id}`});
        }

        if (sample.projectId == 'Mrx3c92PKkipTBMsA') {
            Log.debug("Project is not for analysis yet", sample_id);
            return of({ error: true, message: `Project is not for analysis yet ${sample_id}`});
        }

        FilesUpload.remove({"meta.isOutput": true, "meta.sampleId": sample._id}, (err) => err?Log.error(err): "" );

        let cwl: any = CWLCollection.findOne({_id: sample.cwlId});
        if (!cwl) {
            Log.error("No cwl", sample.cwlId);
            return of({ error: true, message: `no cwl ${sample.cwlId}`, sample: sample });
        }

        const data = {
            run_id: sample_id,
            conf: JSON.stringify({
                job: {...sample.inputs, output_folder: AirflowProxy.output_folder(sample.projectId, sample_id)}
            })
        };

        let dag_id = `${cwl._id}-${cwl.git.sha}`; // path.basename(cwl.git.path, ".cwl");

        Samples.update({"_id": sample_id}, {$set: {"dag_id": dag_id}});

        /**
         * DAG name can be changed in the future
         */
        return AirflowProxy.airflow_post(dag_id, data, sample);
    }

    public static output_folder(projectId, sampleId) {
        //TODO: Parse CWL and check files input are ready!
        const _mp = path.resolve("/", `${projectId}/${sampleId}/`).slice(1);
        return path.resolve(`${Meteor.settings['systemRoot']}/projects/${_mp}/`);
    }
    /**
     * Saves cwl into airflow dir
     *
     * @param cwl_id
     */
    public static save_cwl_to_airflow(cwl_id): Observable<any> {

        let cwl: any = CWLCollection.findOne({_id: cwl_id});
        if (!cwl) {
            Log.error("No cwl", cwl_id);
            return of({ error: true, message: `no cwl ${cwl_id}` });
        }
        let packed = JSON.parse(zlib.gunzipSync(Buffer.from(cwl.source.packed, 'base64')).toString());

        WorkflowsGitFetcher.exportWorkflow(Meteor.settings["airflow"]["dags_folder"], `${cwl._id}-${cwl.git.sha}`, packed);
        return of(cwl._id);
    }

    /**
     * Middleware to listen for a progress report, endpoint + /progress
     * //FIXME: probably memory leak, replace with stream of dags to clean
     */
    public listen_results(request, res, next) {
        let { body } = request;

        if (!body || !body.payload) {
            return next();
        }


        AirflowProxy.listen$.next(body.payload);

        Log.debug('Listen process status:', body.payload);

        let {dag_id, run_id, results} = body.payload;
        /**
         * At first we had to clean previous DAG run,
         * So if report from cleaning DAG, we trigger queued DAG
         */
        if (dag_id === 'clean_dag_run') {
            return next();
        }

        let sample: any = Samples.findOne({_id: run_id});
        if (!sample) {
            Log.error("No sample:", run_id);
            return next();
        }

        /**
         * If report from project with general pipelines either ignore or store outputs locally?
         */
        if (sample.projectId == 'Mrx3c92PKkipTBMsA') {
            Log.debug("Project is not for analysis yet, store results?");
            return next();
        }


        /**
         * Update final results to the master as well as store all the outputs in local file storage ostrio:files
         * moved to the new endpoint /results!
         */
        let outputs: any = AirflowProxy.update_results(results, sample);
        AirflowProxy.master_progress_update(run_id, {progress: {progress: 100, }, outputs}).subscribe(r => Log.debug(r));
    }

    /**
     * Middleware to listen for a progress report, endpoint + /progress
     */
    public listen_progress(request, res, next) {
        let { body } = request;

        if (!body || !body.payload) {
            return next();
        }

        Log.debug('Listen process status:', body.payload);

        // state: 'running','success'
        let {dag_id, run_id, state, progress, error} = body.payload;

        if (dag_id === 'clean_dag_run') {
            return next();
        }

        let sample: any = Samples.findOne({_id: run_id});
        if (!sample) {
            Log.error("No sample:", run_id);
            return next();
        }

        /**
         * If report from project with general pipelines either ignore or store outputs locally?
         */
        if (sample.projectId == 'Mrx3c92PKkipTBMsA') {
            Log.debug("Project is not for analysis yet, store results?");
            return next();
        }

        /**
         * Update progress report to the master
         */
        let progress_to_master: any = null;
        if (error) {
            Log.error({dag_id, run_id, state, progress, error});
            progress_to_master = {
                error,
                progress,
                title: "Error"
            }
        } else {
            Log.debug({dag_id, run_id, state, progress});
            progress_to_master = {
                progress,
                title: state // TODO: ?? Send state?
            }
        }

        let outputs: any = null;
        AirflowProxy.master_progress_update(run_id, {progress: progress_to_master, outputs}).subscribe(r => Log.debug(r));

        return next();
    }

    /**
     * Update outputs with ostrio files id and store info in files collection
     * @param results
     * @param sample
     * @param userId
     */
    private static update_results ( results, sample) {
        Log.debug("Store results!", results);

        let outputs: any = {};

        let getMimeType = (filePath: any) => {
            try {
                return mime.getType(filePath);
            }
            catch(e) {
                return "application/octet-stream";
            }
        }

        let getOpts = (sample: any, filePath: any, fileName: any) => {
            let meta = {
                projectId: sample.projectId,
                sampleId: sample._id,
                userId: sample.userId,
                isOutput: true
            };
            return {meta, fileName, userId: sample.userId, fileId: Random.id(), type: getMimeType(filePath)};
        };

        let processDirectory = (sample:any, output_data: any) => {
            if (output_data.class === "File") {
                let opts = getOpts(sample, output_data.location.replace('file://',''), output_data.basename);
                FilesUpload.addFile(output_data.location.replace('file://',''), opts, (err) => err?Log.error(err): "" );
                output_data['_id'] = opts.fileId;
            } else {
                for ( const i in output_data.listing ) {
                    processDirectory(sample, output_data.listing[i])
                }
            }
        };

        for ( const output_key in results ) {
            if (results[output_key] && results[output_key].class === 'File' ) {

                let opts = getOpts(sample, results[output_key].location.replace('file://',''), `${output_key}${results[output_key].nameext}`);
                FilesUpload.addFile(results[output_key].location.replace('file://',''), opts, (err) => err?Log.error(err): "" );

                outputs[output_key] = results[output_key];
                outputs[output_key]['_id'] = opts.fileId;

                if (results[output_key].secondaryFiles && results[output_key].secondaryFiles.length >0 ) {
                    outputs[output_key].secondaryFiles = results[output_key].secondaryFiles.map( (sf, index) => {

                        let opts = getOpts(sample, sf.location.replace('file://',''), `${output_key}_${index}${sf.nameext}`);
                        FilesUpload.addFile(sf.location.replace('file://',''), opts, (err) => err?Log.error(err): "" );
                        sf['_id'] = opts.fileId;

                        return sf;
                    })
                }
            } else if (results[output_key] && results[output_key].class === 'Directory') {
                processDirectory(sample, results[output_key]);
                outputs[output_key] = results[output_key]
            } else {
                outputs[output_key] = results[output_key];
            }
        }
        return outputs;
    }

    /**
     *
     * @param sample_id
     * @param progress
     * @param outputs
     */
    public static master_progress_update(sample_id, {progress, outputs}): Observable<any> {
        let obj: any =  {
            _id: sample_id
        };

        if ( progress )  {
            obj = { ...obj, progress};
        }

        if ( outputs )  {
            obj = { ...obj, outputs};
        }

        Log.debug("master_progress_update", obj);

        return DDPConnection
            .call("satellite/projects/sample/update", obj)
            .pipe(
                catchError((e) => of({ error: true, message: `Error: ${e}` }))
            )
    }

    public after_cleanup_dag_routine( {result, error, message, sample, warning} ): Observable<any> {
        let progress: any = null;
        if (error) {
            Log.error("Cleanup:", message);
            progress = {
                title: "Error",
                progress: 0,
                error: message
            };

            airflowQueueCollection.remove({sample_id: sample._id});

        } else if (warning) {
            Log.error("Cleanup:", message);
            progress = {
                title: "Warning",
                progress: 0,
                warning: message
            }
        } else if (result) {
            Log.debug("Cleanup:", result);
            progress = {
                title: "Cleaning",
                progress: 0
            }
        }
        if (progress && sample) {
            return AirflowProxy.master_progress_update(sample._id, {progress} as any)
        } else {
            return of({error: true, message: `No sample ${message}`});
        }
    }


}

export const airflowProxy = new AirflowProxy();

Meteor.startup(() => {
    /**
     * Server startup
     * connect DDP master server and Airflow API
     * connection.$events are master's samples updated
     * ariaDownload.events$ are emitted when sample's inputs download has completed with success or error
     */

    connection.events$
        .pipe(
            tap(d => Log.debug("Connection Events:", d)),
            // @ts-ignore
            filter(({name, event, id}) => name == 'samples' && ['added', 'changed'].includes(event)),
            filter(({name, event, id}) => ariaDownload.checkInputs(id)),
            concatMap((d: any) => pdelay(d, 2000)),
            switchMap(({name, event, id}) => { // collection name, event {added, changed, removed}, id - sample id
                return airflowProxy.cleanup_dag(id);
            }),
            mergeMap( ({result, error, warning, message, sample}) => {
                return airflowProxy.after_cleanup_dag_routine({result, error, message, sample, warning});
            }),
            catchError((e) => of({ error: true, message: `Error: ${e}` }))
        )
        .subscribe( (r: any) => r && r.error ? Log.error(r) : Log.debug(r) );


    ariaDownload.events$
        .pipe(
            tap(d => Log.debug("aria2 download Event:", d)),
            filter(({sampleId, error}) => !error),
            switchMap(({sampleId, error}) => {
                return airflowProxy.cleanup_dag(sampleId);
            }),
            mergeMap( ({result, error, message, sample, warning}) => {
                return airflowProxy.after_cleanup_dag_routine({result, error, message, sample, warning});
            }),
            catchError((e) => of({ error: true, message: `Error: ${e}` }))
        )
        .subscribe( (r: any) => r && r.error ? Log.error(r) : Log.debug(r) );

    // For testing
    // connection._main_events$.next({name: "samples", event: 'added', id: "nvYBtNTDTyetcKdBn"});

});
