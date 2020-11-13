import { Meteor } from 'meteor/meteor';

import { DDPConnection, connection } from './ddpconnection';

import {
    catchError,
    switchMap,
    map,
    filter,
    tap,
    mergeMap, reduce
} from 'rxjs/operators';
import { Observable, of } from 'rxjs';

import { FilesUpload } from '../methods/filesupload';

import * as csv from 'fast-csv';
import * as fs from 'fs';

import { Log } from './logger';

/**
 * Works with RC Server requests, sends data back
 */
class DataProxy {

    constructor () {
    }

    /**
     *
     * @param request_id
     * @param data
     */
    public static master_data_update({_id, data}): Observable<any> {
        Log.debug('master_data_update:', {_id, data});
        return DDPConnection
            .call("satellite/requests/fulfill", {_id, data})
            .pipe(
                catchError((e) => of({ error: true, message: `Error: ${e}` }))
            )
    }

    /**
     * Reads csv (tab delimited) file from the path!
     * @param path
     * @param options
     */
    public static csvfileDataStream (path: string, options? ): Observable<any> {
        let file$ = fs.createReadStream(path, {encoding: 'utf8'}).pipe(csv(options));

        return new Observable((observer) => {

            file$.on('data', Meteor.bindEnvironment((chunk) => observer.next(chunk)));
            file$.on('end', Meteor.bindEnvironment(() => observer.complete()));
            file$.on('close', Meteor.bindEnvironment(() => observer.complete()));
            file$.on('error', Meteor.bindEnvironment((error) => observer.error(error)));

            // there seems to be no way to actually close the stream
            return () => file$.destroy();
        });
    }

    /**
     *
     * @param fileId
     * @param fields
     * @param _id
     * @param delimiter
     * @param headers
     */
    public static request_file_data(fileId, fields, _id, delimiter='\t', headers=false): Observable<any>|any {

        let file = FilesUpload.findOne({_id: fileId});

        if (!file) {
            Log.error("Failed to find a file by id:", fileId);
            return of({ error: true, message: `Failed to find a file by id ${fileId}`});
        }

        const req_fields = fields.map((e) => (e.startsWith('$') ? e.slice(1)*1.0 : e*1.0) - 1);

        let clean = (x) => {
            if (isNaN(x)) {
                return x;
            }
            return x*1.0;
        };

        return this.csvfileDataStream(file.get('path'), {
            delimiter, headers
        }).pipe(
            reduce((acc, data) => {
                req_fields.forEach( (e, i) => acc[i].push(clean(data[e])));
                return acc;
            }, fields.map(() => []))
        );
    }
}


Meteor.startup( () => {
    /**
     * Server startup
     * connect DDP master server and Airflow API
     * $events are master's samples updated
     */
    connection.requests$
        .pipe(
            filter(({name, event}) => name === 'requests' && 'added' === event),
            switchMap( ({name, event, _id, fileId, data, delimiter }) =>
                DataProxy.request_file_data(fileId, data, _id).pipe(map((d) => ({_id, data: d})))
            ),
            filter((r: any) => !r.data.error),
            mergeMap((d) => DataProxy.master_data_update(d as any)),
            catchError((e) => of({ error: true, message: `Error: ${e}` }))
        )
        .subscribe( (r: any) => {
            r && r.error ? Log.error(r) : Log.debug(r);
        });
});
