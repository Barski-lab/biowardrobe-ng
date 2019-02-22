/**
 * Created by porter on 10/28/15.
 */

// import { mysql } from "../node_modules/mysql";

import { Observable } from 'rxjs/Observable';
import { Meteor } from 'meteor/meteor';

import { createPool } from 'mysql';

import { Log } from '../logger';
import { Subscriber } from 'rxjs/Subscriber';
import { of } from 'rxjs/observable/of';

// export const experimentType = {
//     1: 'DNA-Seq',
//     2: 'DNA-Seq pair',
//     3: 'RNA-Seq',
//     4: 'RNA-Seq pair',
//     5: 'RNA-Seq dUTP',
//     6: 'RNA-Seq dUTP pair'
// };

export const right_where=
    "( laboratory_id = (select laboratory_id from worker where shadow=?)"+
    " or egroup_id in"+
    " (select e.id from egroup e inner join worker w on e.laboratory_id=w.laboratory_id where w.shadow=?)"+
    " or egroup_id in" +
    " (select egroup_id from egrouprights e"+
    " inner join worker w on e.laboratory_id=w.laboratory_id where w.shadow=?)) ";

const config = Meteor.settings['biowardrobe'] || {
    db: {
        host:"localhost",
        user: "",
        password: "",
        database: "ems",
        port:3306
    }
};

const mysqlPool = createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    port: config.db.port
});

export class BioWardrobeMySQL {

    /**
     *  Runs a MySQL query and return Observable
     * @param {string} query
     * @returns {Observable<any>}
     */
    private static mysqlQuery (query: string): Observable<any> {
        return Observable.create((observer: Subscriber<Meteor.Error | any>) => {
            mysqlPool.getConnection(
                Meteor.bindEnvironment((err, connection) => {
                        if (err) {
                            Log.error('biowardrobemysql.ts: mysqlQuery:', err.message);
                            observer.error(err);
                            return;
                        }
                        connection.query(query, [],
                            Meteor.bindEnvironment(
                                function (error, rows, fields) {
                                    connection.release();
                                    error ? observer.error(error) : observer.next([rows, fields]);
                                    observer.complete();
                                }
                            )
                        );
                    }
                ));
        });
    }

    /**
     * selects all workers with email or filtered by domain from BioWardrobe
     * Important fields: worker, fname, lname, laboratory_id, admin, changepass
     * @param domain - filter emails by domain
     * @returns {Observable<any>}
     */
    public static getWorkers(domain?): Observable<any> {
        if (domain) {
            return BioWardrobeMySQL.mysqlQuery(`SELECT * from worker where email like '%@${domain}'`);
        }
        return BioWardrobeMySQL.mysqlQuery('SELECT * from worker where email is not null');
    }

    /**
     * selects id, name, description from laboratory
     * @returns {Observable<any>}
     */
    public static getLaboratories(): Observable<any> {
        return BioWardrobeMySQL.mysqlQuery('SELECT id, name, description from laboratory');
    }

    public static getSettings(): Observable<any> {
        return BioWardrobeMySQL.mysqlQuery('SELECT * FROM ems.settings')
            .switchMap((settings) => {
                let settingsMap = {};
                for (let i = 0; i < settings[0].length; ++i) {
                    settingsMap[settings[0][i]["key"]] = settings[0][i]["value"];
                }
                return of(settingsMap);
            });
    }

    /**
     * Gets egroups id, laboratory_id, name, description
     * Now egroups are projects
     * @returns {Observable<any>}
     */
    public static  getEgroups(): Observable<any>  {
        return BioWardrobeMySQL.mysqlQuery('SELECT id,laboratory_id,name,description from egroup');
    }

    /**
     *
     * @returns {Observable<any>}
     */
    public static  getEgroupRights(): Observable<any>  {
        return BioWardrobeMySQL.mysqlQuery('SELECT egroup_id, laboratory_id from egrouprights');
    }

    /**
     *
     */
    public static getExperiments(): Observable<any> {
        return BioWardrobeMySQL.mysqlQuery(
            `
            SELECT l.id, uid, name4browser,  egroup_id, p.name as egroup_name, deleted, groupping, cells, conditions, size,
            dateadd, datedel, dateanalyzed, dateanalyzes, dateanalyzee, libstatus, libstatustxt, url,filename, filenameold,
            tagstotal, tagsmapped, tagssuppressed, tagsused, tagsribo, params,
            fragmentsize, fragmentsizeest, fragmentsizeexp, fragmentsizeforceuse, notes, protocol, islandcount,
            experimenttype_id, browsergrp, browsershare, forcerun, rmdup, antibodycode, trim3, trim5, control,
            control_id, genome_id, download_id, l.laboratory_id, antibody_id,

        e.etype, e.workflow, e.template, e.upload_rules,

        g.db, g.findex, g.annotation, g.annottable, g.genome, g.gsize as genome_size,

        COALESCE(l.trim5,0) as clip_5p_end, COALESCE(l.trim3,0) as clip_3p_end,
        COALESCE(fragmentsizeexp,0) as exp_fragment_size, COALESCE(fragmentsizeforceuse,0) as force_fragment_size,
        COALESCE(l.rmdup,0) as remove_duplicates,
        COALESCE(control,0) as control, COALESCE(control_id,'') as control_id,

        COALESCE(a.properties,0) as broad_peak, author, a.antibody,

        COALESCE(w.email,'') as email

        from labdata l
        inner join (experimenttype e,genome g ) ON (e.id=experimenttype_id and g.id=genome_id)
        LEFT JOIN (egroup p) ON (l.egroup_id=p.id)
        LEFT JOIN (antibody a) ON (l.antibody_id=a.id)
        LEFT JOIN (worker w) ON (l.worker_id=w.id)

             where egroup_id is not null and libstatus > 2 and libstatus < 100 and deleted=0
            `
        );
    }

    public static getExperimentTypes(): Observable<any> {
        return BioWardrobeMySQL.mysqlQuery(
            `SELECT id, etype, workflow from experimenttype`
        );
    }

    /**
     * selects * from antibody
     * @returns {Observable<any>}
     */
    public static getAntibodies(): Observable<any> {
        return BioWardrobeMySQL.mysqlQuery('SELECT * from antibody');
    }

    /**
     * selects * from genome
     * @returns {Observable<any>}
     */
    public static getGenome(): Observable<any> {
        return BioWardrobeMySQL.mysqlQuery('SELECT * from genome');
    }

}

// export function get_experiments(){
//     return new Promise((resolve, reject) => {
//         mysqlPool.getConnection(function (err, connection) {
//             connection.query(
//                 'SELECT id,uid,name4browser, author, egroup_id,deleted,groupping,cells,conditions,size,'+
//                 'dateadd,datedel, dateanalyzed,dateanalyzes, dateanalyzee,libstatus,libstatustxt,url,filename,filenameold,' +
//                 '`tagstotal`, `tagsmapped`, `tagssuppressed`, `tagsused`, `tagsribo`,params,'+
//                 '`fragmentsize`,`fragmentsizeest`,`fragmentsizeexp`,`fragmentsizeforceuse`, notes,protocol,islandcount,'+
//                 'experimenttype_id,browsergrp,browsershare,forcerun,rmdup,antibodycode,trim3,trim5,control,' +
//                 'control_id,genome_id,download_id,laboratory_id,antibody_id'+
//                 ' from labdata where egroup_id is not null and libstatus > 0 and libstatus < 100'
//                 , [],
//                 function (err, rows, fields) {
//                     connection.release();
//                     if (err == null && rows.length > 0) {
//                         resolve(rows);
//                     } else {
//                         reject('nothing');
//                     }
//                 });
//         });
//     });
// }

