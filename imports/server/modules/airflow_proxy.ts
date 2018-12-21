import { HTTP } from 'meteor/http';
import { Meteor } from 'meteor/meteor';

import { DDPConnection, connection} from './ddpconnection';

import { Log } from './logger';
import { CWLCollection, Samples, airflowQueueCollection } from '../../collections/shared';
import {
    catchError,
    switchMap,
    map,
    filter,
    tap,
    mergeMap
} from 'rxjs/operators';

import { bindNodeCallback } from 'rxjs/observable/bindNodeCallback';
import { of } from 'rxjs/observable/of';
import { Observable } from 'rxjs';

import * as path from 'path';
import * as express from 'express';
import * as bodyParser from 'body-parser';


class AirflowProxy {

    private app:any = undefined;
    private routes = undefined;

    constructor () {
        this.initRoutes ();
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
    private initRoutes(){
        let self = this;
        this.app = express();
        this.routes = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        this.app.post('/airflow/process/status', this.debugMiddle, Meteor.bindEnvironment(self.listen_progress));
        this.app.use(this.routes);
        WebApp.rawConnectHandlers.use(this.app);
    }

    /**
     * Returns airflow API url for a dag
     * @param dag_id
     */
    private dag_url (dag_id): string {
        return Meteor.settings["airflow"]["trigger_dag"].replace("{dag_id}", dag_id);
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

        let dag_id = path.basename(cwl.git.path, ".cwl");

        let queue = airflowQueueCollection.findOne({sample_id});
        if (queue) {
            return of({ error: true, message: `Not yet cleaned`, sample: sample });
        }

        let queue_id = airflowQueueCollection.insert({sample_id});

        const trigger_dag_url: string = this.dag_url('clean_dag_run');
        const data = {run_id: queue_id, conf: JSON.stringify({remove_dag_id: dag_id, remove_run_id: sample_id}) };

        Log.debug("Let's trigger cleanup:", trigger_dag_url, data);

        return bindNodeCallback(HTTP.post)(
            trigger_dag_url,
            {
                data,
                timeout: 10000
            })
            .pipe(
                map((result) => ({result, sample})),
                catchError((e) => of({ error: true, message: `Airflow POST: ${e}`, sample: sample }))
            );
    }

    /**
     * Triggers Airflow's DAG by queue id
     * Finds sample and corresponding CWL (FIXME: airflow has to kill by run_id)
     *
     * @param queue_id
     */
    public trigger_dag(queue_id): Observable<any> {

        if (!Meteor.settings["airflow"] || !Meteor.settings["airflow"]["trigger_dag"]) {
            return of({ error: true, message: `no airflow settings`});
        }

        let queue: any = airflowQueueCollection.findOne({queue_id});
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

        let cwl: any = CWLCollection.findOne({_id: sample.cwlId});
        if (!cwl) {
            Log.error("No cwl", sample.cwlId);
            return of({ error: true, message: `no cwl ${sample.cwlId}`, sample: sample });
        }

        //TODO: Parse CWL and check files input are ready!

        const trigger_dag_url: string = this.dag_url(path.basename(cwl.git.path, ".cwl"));
        const data = {run_id: sample_id, conf: JSON.stringify({job: {...sample.inputs, output_folder: "/tmp"}}) };

        Log.debug("Let's trigger a workflow:", trigger_dag_url, data);

        return bindNodeCallback(HTTP.post)(
            trigger_dag_url,
            {
                data,
                timeout: 10000
            })
            .pipe(
                map((result) => ({result, sample})),
                catchError((e) => of({ error: true, message: `Airflow POST: ${e}`, sample: sample }))
            );
    }

    /**
     *
     */
    public listen_progress(request, res, next) {
        let { body } = request;

        Log.debug('Listen process status:', body);

        if (body && body.payload) {
            // state: 'running','success'
            let {dag_id, run_id, execution_date, state, progress, title, error, tasks, start_date, end_date} = body.payload;

            if (dag_id === 'clean_dag_run') {
                let queue: any = airflowQueueCollection.findOne({_id: run_id});
                if (!queue) {
                    Log.debug("No queue", {dag_id, run_id, state, title, progress, error});
                    return;
                }
                let {sample_id} = queue;
                // TODO: update progress!
                if ( progress === 'success') {

                }
                return;
            }

            if (error) {
                Log.error({dag_id, run_id, state, title, progress, error});
            } else {
                Log.debug({dag_id, run_id, state, title, progress});
            }
            Log.debug(tasks);
        }
        return next();
    }

    public master_progress_update(sample_id, progress): Observable<any> {
        return DDPConnection
            .call("satellite/projects/sample/update",
                {
                    _id: sample_id,
                    progress
                })
            .pipe(
                catchError((e) => of({ error: true, message: `Error: ${e}` }))
            )
    }
}

const airflowProxy = new AirflowProxy();

/**
 * Server startup
 * connect DDP master server and Airflow API
 * $events are master's samples updated
 */
connection.events$
    .pipe(
        tap(d => Log.debug("Events:", d)),
        // @ts-ignore
        filter(({name, event, id}) => name == 'samples' && ['added', 'changed'].includes(event)),
        switchMap(({name, event, id}) => { // collection name, event {added, changed, removed}, id - sample id
            return airflowProxy.cleanup_dag(id);
        }),
        mergeMap( ({result, error, message, sample}) => {
            let progress: any = null;
            if (error) {
                Log.error("Cleanup:", message);
                progress = {
                    title: "Error",
                    progress: 0,
                    error: message
                }
            } else if (result) {
                Log.debug("Cleanup:", result);
                progress = {
                    title: "Cleaning",
                    progress: 0
                }
            }
            if (progress && sample) {
                return airflowProxy.master_progress_update(sample._id, progress)
            } else {
                throw new Error(`No sample ${progress}`);
            }
        }),
        catchError((e) => of({ error: true, message: `Error: ${e}` }))
    )
    .subscribe( (r) => {
        if (r && r.error) {
            Log.error(r);
        } else {
            Log.debug(r);
        }
    });
