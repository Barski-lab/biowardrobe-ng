/**
 * Created by porter on 10/28/15.
 */

// import { mysql } from "../node_modules/mysql";

import { Observable } from 'rxjs/Observable';
import { Meteor } from 'meteor/meteor';

import { createPool } from 'mysql';

import { Log } from '../logger';
import { Subscriber } from 'rxjs/Subscriber';


export const experimentType = {
    1: 'DNA-Seq',
    2: 'DNA-Seq pair',
    3: 'RNA-Seq',
    4: 'RNA-Seq pair',
    5: 'RNA-Seq dUTP',
    6: 'RNA-Seq dUTP pair'
};

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

    private static mysqlQuery (query: string): Observable<any> {
        return Observable.create((observer: Subscriber<Meteor.Error | any>) => {
            mysqlPool.getConnection(
                Meteor.bindEnvironment((err, connection) => {
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


export function get_workers(){
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection(function (err, connection) {
            connection.query(
                'SELECT * from worker where email is not null', [],
                function (err, rows, fields) {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }
                });
        });
    });
}

export function get_antibodies(){
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection(function (err, connection) {
            connection.query(
                'SELECT * from antibody', [],
                function (err, rows, fields) {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }
                });
        });
    });
}

export function get_genome(){
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection(function (err, connection) {
            connection.query(
                'SELECT * from genome', [],
                function (err, rows, fields) {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }
                });
        });
    });
}

export function get_experiments(){
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection(function (err, connection) {
            connection.query(
                'SELECT id,uid,name4browser, author, egroup_id,deleted,groupping,cells,conditions,size,'+
                'dateadd,datedel, dateanalyzed,dateanalyzes, dateanalyzee,libstatus,libstatustxt,url,filename,filenameold,' +
                '`tagstotal`, `tagsmapped`, `tagssuppressed`, `tagsused`, `tagsribo`,params,'+
                '`fragmentsize`,`fragmentsizeest`,`fragmentsizeexp`,`fragmentsizeforceuse`, notes,protocol,islandcount,'+
                'experimenttype_id,browsergrp,browsershare,forcerun,rmdup,antibodycode,trim3,trim5,control,' +
                'control_id,genome_id,download_id,laboratory_id,antibody_id'+
                ' from labdata where egroup_id is not null and libstatus > 0 and libstatus < 100'
                , [],
                function (err, rows, fields) {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }
                });
        });
    });
}

export function get_laboratories() {
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection((err, connection) => {
            connection.query(
                'SELECT id, name, description from laboratory ', [],
                (err, rows, fields) => {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }

                });
        });
    })
}

export function get_egroups() {
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection((err, connection) => {
            connection.query(
                'SELECT id,laboratory_id,name,description from egroup ', [],
                (err, rows, fields) => {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }
                });
        });
    })
}

export function get_egroupr() {
    return new Promise((resolve, reject) => {
        mysqlPool.getConnection((err, connection) => {
            connection.query(
                'SELECT egroup_id, laboratory_id' +
                ' from egrouprights', [],
                (err, rows, fields) => {
                    connection.release();
                    if (err == null && rows.length > 0) {
                        resolve(rows);
                    } else {
                        reject('nothing');
                    }
                });
        });
    })
}

