import { Meteor } from 'meteor/meteor';
import { WorkflowsGitFetcher } from '../../methods/git';
import {
    switchMap,
    filter,
    take,
    catchError,
    concatAll,
    takeLast,
    mergeMap,
    reduce,
    map
} from 'rxjs/operators';
import { of } from 'rxjs/observable/of';

import { DDPConnection, connection } from '../ddpconnection';

import {
    BioWardrobeMySQL,
} from './biowardrobemysql';

import { Log } from '../logger';
import { CWLCollection, Labs, Projects, Samples } from '../../../collections/shared';
import { Observable } from 'rxjs';

const Mustache = require('mustache');

// delete Package.webapp.main;

let _laboratories = {};

const stats = {
    storage: 0,
    cputime: 0,
    users: 0,
    experiments: 0,
    newexperiments: 0,
    date: 0
};

/**
 * BioWardrobe class wraps BioWardrobeMySQL calls (access to biowardrobe mysql database tables)
 * to sync differences with local mongodb and remote instance of biowardrobe-ng
 */
class BioWardrobe {

    /**
     * Imports workers into local users mongo collection and syncs users with remote server (trough 'satellite/accounts/createUser' call)
     *
     * @returns {Observable<any|{error: boolean, message: string}>} last imported user or an error {}
     */
    static getWorkers(): Observable<any> {
        return BioWardrobeMySQL.getWorkers(Meteor.settings["oauth2server"]["domain"])
            .pipe(
                switchMap((ws) => of(...ws[0])),
                filter((w) => {
                    const email = w['email'].toLowerCase();
                    return (email && email.length !== 0 && email.endsWith('@' + Meteor.settings["oauth2server"]["domain"]));
                }),
                mergeMap((w) => {
                    const email = w['email'].toLowerCase();
                    const user = Meteor.users.findOne({ 'emails.address': email });
                    if (!user) {
                        if (!Meteor.settings.rc_server) {
                            let userId = Accounts.createUser({
                                email: email,
                                profile: {
                                    firstName: w['fname'],
                                    lastName: w['lname'],
                                }
                            });
                            Accounts.addEmail(userId, email, true);
                            return of(userId);
                        } else {
                            Log.debug('Call createUser', w['fname'], w['lname'], email);
                            return DDPConnection.call('satellite/accounts/createUser', w['fname'], w['lname'], email);
                        }
                    }
                    if(!user["biowardrobe_import"]) {
                        return of(user['_id']);
                    } else {
                        return of(null);
                    }
                }, (biowardrobeRecord, userId, outerIndex, innerIndex) => ({ userId, biowardrobeRecord })),
                filter(_ => _.userId),
                reduce((acc, val) => {
                    const w = val.biowardrobeRecord;
                    // TODO: check users email, if not exist add
                    Meteor.users.update({ _id: val.userId }, {
                        $set: {
                            biowardrobe_import: {
                                laboratory_id: w['laboratory_id'],
                                admin: w['admin'],
                                laboratory_owner: w['changepass'],
                                synchronized: !!Meteor.settings.rc_server
                            }
                        }
                    }, { upsert: true });
                    return { count: acc['count'] + 1, message: 'Users import complete' } as any;
                }, { count: 0, message: 'Users import complete' } as any),
                catchError((e) => of({ error: true, message: `Create user: ${e}` }))
            );
    }

    /**
     * Imports Laboratories into local laboratory mongo collection and syncs laboratories with remote server
     * (trough 'satellite/accounts/createLab' call)
     */
    static getLaboratories() {
        return BioWardrobeMySQL.getLaboratories()
            .pipe(
                switchMap((ls) => of(...ls[0])),
                mergeMap((l) => {
                    const user = Meteor.users.findOne(
                        {
                            $and: [
                                { 'biowardrobe_import.laboratory_id': l.id },
                                { 'biowardrobe_import.laboratory_owner': 1 }
                            ]
                        });
                    if (!user) {
                        Log.error('No owner for lab:', l.id);
                        return of(null);
                    }

                    const lab = Labs.findOne({ "owner._id": user._id });
                    if (!lab) {
                        if (!Meteor.settings.rc_server) {
                            const uo: any = {
                                name: l.name,
                                description: l.description,
                                modified: Date.now() / 1000.0,
                                owner: {
                                    _id: user._id,
                                    lastName: user.profile.lastName,
                                    firstName: user.profile.firstName
                                }
                            };
                            return of(Labs.insert(uo));
                        } else {
                            Log.debug('Add lab:', user, l.name);
                            return DDPConnection.call('satellite/accounts/createLab', user._id, l.name, l.description);
                        }
                    }
                    return of(null)
                }, (biowardrobeRecord, labId, outerIndex, innerIndex) => ({ labId, biowardrobeRecord })),
                filter(_ => !!_.labId),
                reduce((acc, val) => {
                    Labs.update({ _id: val.labId }, {
                        $set: {
                            biowardrobe_import: {
                                laboratory_id: val.biowardrobeRecord.id,
                                synchronized: !!Meteor.settings.rc_server
                            }
                        }
                    }, { upsert: true });
                    return { count: acc['count'] + 1, message: 'Laboratories import complete' } as any;
                }, { count: 0, message: 'Laboratories import complete' } as any),
                catchError((e) => of({ error: true, message: `Create laboratory: ${e}` }))
            );
    }

    /**
     * Imports Project (former Folders) into local project mongo collection and syncs projects with remote server
     * (trough 'satellite/projects/createProject' call)
     */
    static getProjects() {
        return BioWardrobeMySQL.getEgroups() // Projects now
            .pipe(
                switchMap((es) => of(...es[0])),
                mergeMap((p) => {
                    const project = Projects.findOne({ "biowardrobe_import.project_id": p.id });
                    const lab: any = Labs.findOne({ "biowardrobe_import.laboratory_id": p.laboratory_id });
                    if (!project && lab) {
                        if (!Meteor.settings.rc_server) {
                            const _attachCWL = CWLCollection.find({
                                $and: [
                                    {
                                        "servicetags": {
                                            "$regex": "Basic Analysis",
                                            "$options": "i"
                                        }
                                    }
                                ]
                            }, { _id: 1 }).fetch();
                            const project_id = Projects.insert(
                                {   "name": p['name'],
                                    "description": p['description'] || "",
                                    "labs": [
                                        {
                                            "_id": lab['_id'],
                                            "name": lab['name'],
                                            "main": true
                                        }
                                    ],
                                    "modified": Date.now() / 1000.0,
                                    "cwl": _attachCWL
                                });
                            return of(project_id);
                        } else {
                            Log.error(`Add project: ${p.name} to the lab ${lab.name}`);
                            const description = p['description'] || "";
                            return DDPConnection.call('satellite/projects/createProject',
                                { _id: lab['_id'], name: lab['name'], main: true },
                                { name: p['name'], description: description });
                        }
                    }
                    return of(null);
                }, (biowardrobeRecord, projectId, outerIndex, innerIndex) => ({ projectId, biowardrobeRecord })),
                filter(_ => !!_.projectId),
                reduce((acc, val) => {
                    Log.info(`Update project: ${val.projectId} `);

                    Projects.update({ _id: val.projectId }, {
                        $set: {
                            biowardrobe_import: {
                                project_id: val.biowardrobeRecord.id,
                                synchronized: !!Meteor.settings.rc_server
                            }
                        }
                    }, { upsert: true });
                    return { count: acc['count'] + 1, message: 'Projects import complete' } as any;
                }, { count: 0, message: 'Projects import complete' } as any),
                catchError((e) => of({ error: true, message: `Create project: ${e}` }))
            );
    }

    /**
     * Syncs projects sharing properties with remote server (trough 'satellite/projects/...' call)
     * @todo Not yet finished
     */
    static getProjectShares() {
        return BioWardrobeMySQL.getEgroupRights().pipe(
            switchMap((es) => of(...es[0])),
            reduce((acc, p) => {
                const project: any = Projects.findOne({ "biowardrobe_import.project_id": p.egroup_id }); // Projects now!
                const lab: any = Labs.findOne({ "biowardrobe_import.laboratory_id": p.laboratory_id });
                if (project && lab) {
                    if (!project.labs.find((l) => l._id === lab._id)) {
                        const l_obj = {
                            _id: lab._id,
                            name: lab.name,
                            main: false
                        };

                        // Log.debug('Giving access to a project for a lab :', project._id, l_obj);
                        return { count: acc['count'] + 1, message: 'Access to projects for labs complete' } as any;
                    }
                } else {
                    // Log.error('Lab or project does not exist!', p, {project: !!project, lab: !!lab});
                }
                return { count: acc['count'], message: 'Access to projects for labs complete' } as any;
            }, { count: 0, message: 'Access to projects for labs complete' } as any),
            catchError((e) => of({ error: true, message: `Access to a project for a lab: ${e}` }))
        );
    }

    /**
     *
     */
    static getSamples() {
        return BioWardrobeMySQL.getExperiments().pipe(
            switchMap((es) => of(...es[0])),
            mergeMap((e) => {
                const sample = Samples.findOne({ 'biowardrobe_import.sample_uid': e.uid });
                if (sample) {
                    return of(null)
                }
                // Log.error('No sample with uid:', e.uid );

                let _settings = {
                    'advanced': '/ANL-DATA',
                    'airflowdb': 'airflow',
                    'bin': '/bin',
                    'experimentsdb': 'experiments',
                    'genomebrowserroot': '',
                    'indices': '/indices',
                    'maxthreads': '6',
                    'preliminary': '/RAW-DATA',
                    'temp': '/tmp',
                    'upload': '/upload',
                    'wardrobe': '/wardrobe',
                    'wardroberoot': '/ems'
                };
                const biowardrobe_connection_id = "biowardrobe";
                const BOWTIE_INDICES = "bowtie";
                const STAR_INDICES = "STAR";
                const ANNOTATIONS = "annotations";
                const CHR_LENGTH_GENERIC_TSV = "chrNameLength.txt";
                const ANNOTATION_GENERIC_TSV = "refgene.tsv";

                e = {
                    ...e,
                    "pair": e['etype'].includes('pair'),
                    "dUTP": e['etype'].includes('dUTP'),
                    "forcerun": e['forcerun'] === 1,
                    "spike": e['genome'].includes('spike'),
                    "force_fragment_size": e['force_fragment_size'] === 1,
                    "broad_peak": e['broad_peak'] === 2,
                    "remove_duplicates": e['remove_duplicates'] === 1,
                    "params": e['params'] || '{}',
                    "raw_data": [_settings['wardrobe'], _settings['preliminary']].join('/').replace(/\/\//g, '/'),
                    "upload": [_settings['wardrobe'], _settings['upload']].join('/').replace(/\/\//g, '/'),
                    "indices": [_settings['wardrobe'], _settings['indices']].join('/').replace(/\/\//g, '/'),
                    "threads": _settings['maxthreads'],
                    "experimentsdb": _settings['experimentsdb'],
                };

                e = {
                    ...e,
                    "fastq_file_upstream": ['file:/', e["raw_data"], e["uid"], e["uid"] + '.fastq.bz2'].join('/'),
                    "fastq_file_downstream": ['file:/', e["raw_data"], e["uid"], e["uid"] + '_2.fastq.bz2'].join('/'),
                    "star_indices_folder": ['file:/', e["indices"], STAR_INDICES, e["findex"]].join('/'),
                    "bowtie_indices_folder": ['file:/', e["indices"], BOWTIE_INDICES, e["findex"]].join('/'),
                    "bowtie_indices_folder_ribo": ['file:/', e["indices"], BOWTIE_INDICES, e["findex"] + "_ribo"].join('/'),
                    "chrom_length": ['file:/', e["indices"], BOWTIE_INDICES, e["findex"], CHR_LENGTH_GENERIC_TSV].join('/'),
                    "annotation_input_file": ['file:/', e["indices"], ANNOTATIONS, e["findex"], ANNOTATION_GENERIC_TSV].join('/'),
                    "exclude_chr": e['spike'] ? "control" : "",
                    "output_folder": [e["raw_data"], e["uid"]].join('/'),
                    "control_file": e['control_id'] ? [e["raw_data"], e["control_id"], e["control_id"] + '.bam'].join('/') : ""
                };

                let input = JSON.parse(
                    Mustache.render(
                        e['template'].replace(/{{/g, '<<').replace(/}}/g, '>>').replace(/{/g, '{{{').replace(/}/g, '}}}'),
                        e).replace(/<</g, '{').replace(/>>/g, '}'),
                    (key, value) => {

                        if (value === "false") {
                            return false;
                        }
                        if (value === "true") {
                            return true;
                        }
                        return value;
                    });

                if (!e['control_file']) {
                    delete (input['control_file']);
                }

                e['project'] = Projects.findOne({ "biowardrobe_import.project_id": e.egroup_id }); // Projects now!
                e['laboratory'] = Labs.findOne({ "biowardrobe_import.laboratory_id": e.laboratory_id });

                if (!e['project'] || !e['laboratory']) {
                    _laboratories[e.laboratory_id] = 1;
                    return of(null);
                }

                e['input'] = input;

                e["metadata"] = {
                    "cells": e["cells"],
                    "conditions": e["conditions"],
                    "alias": e["name4browser"],
                    "notes": e["notes"] || "",
                    "protocol": e["protocol"] || "",
                    "grouping": e["groupping"] || ""
                };

                e['cwl'] = CWLCollection.findOne(
                    { "git.path": "workflows/" + e["workflow"] });

                if (!e['cwl'] || !e['cwl']._id) {
                    return of(null);
                }

                const _upstream_data = Samples.findOne(
                    {
                        $and: [
                            { "projectId": "Mrx3c92PKkipTBMsA" }, // Default project for all precomputed data
                            // { "cwlId": _upstream_id },
                            { "inputs.genome": e['db'] }
                        ]
                    } as any);
                e['upstreams'] = { 'genome_indices': _upstream_data };

                if (e['etype'].includes('RNA')) {

                    e['pie'] = {
                        colors: ['#b3de69', '#99c0db', '#fb8072', '#fdc381'],
                        data: [
                            ['Transcriptome', e['tagsused']],
                            ['Multi-mapped', e['tagssuppressed']],
                            ['Unmapped', e['tagstotal'] - e['tagsmapped'] - e['tagssuppressed']],
                            ['Outside annotation', e['tagsmapped'] - e['tagsused']]
                        ]
                    };
                } else {

                    e["metadata"] = {
                        ...e["metadata"],
                        "antibody": (e["antibody"] || "").trim(),
                        "catalog": (e["antibodycode"] || "").trim()
                    };

                    e['pie'] = {
                        colors: ['#b3de69', '#99c0db', '#fb8072', '#fdc381'],
                        data: [
                            ['Mapped', e['tagsused']],
                            ['Multi-mapped', e['tagssuppressed']],
                            ['Unmapped', e['tagstotal'] - e['tagsmapped'] - e['tagssuppressed']],
                            ['Duplicates', e['tagsmapped'] - e['tagsused']]
                        ]
                    };
                }

                const user = Meteor.users.findOne({ 'emails.address': e['email'].toLowerCase() });

                if (user) {
                    e['author'] = `${user.profile.lastName}, ${user.profile.firstName}`;
                    e['userId'] = user._id;
                } else {
                    e['author'] = `${e['laboratory'].owner.lastName}, ${e['laboratory'].owner.firstName}`;
                    if (!e['laboratory'].owner) {
                        Log.error(e['laboratory']);
                    }
                    e['userId'] = e['laboratory'].owner._id;
                }
                e['params'] = JSON.parse(e['params']);
                // Log.debug(user, e['laboratory']);
                return of(e);
            },
                (biowardrobeRecord, sample, outerIndex, innerIndex) => ({ sample, biowardrobeRecord })),
            filter((e) => {
                const exp = e.sample;
                return exp && exp['cwl'] && exp['cwl']._id && exp['project']._id && exp['params'] && exp['params']['bambai_pair']; // && exp['etype'].includes('RNA')
            }),
            mergeMap((e) => {
                const exp = e.sample;
                Log.error('No sample with uid:', exp.uid );

                let _sample = {
                    "userId": exp['userId'],
                    "author": exp['author'],
                    "cwlId": exp['cwl']._id,
                    "projectId": exp['project']._id,
                    "date": {
                        "created": new Date(exp['dateadd']),
                        "analyzed": new Date(exp['dateanalyzed']),
                        "analyse_start": new Date(exp['dateanalyzes']),
                        "analyse_end": new Date(exp['dateanalyzee']),
                    },
                    "metadata": exp['metadata'],
                    "upstream": exp['upstreams'],
                    "inputs": exp['input'],
                    "outputs": exp['params'],
                    "preview": {
                        "position1": exp['metadata']['cells'],
                        "position2": exp['metadata']['alias'],
                        "position3": exp['metadata']['conditions'],
                        "visualPlugins": [
                            { "pie": exp['pie'] }
                        ]
                    }
                };
                e.biowardrobeRecord["new_sample"] = _sample;
                // Log.error('Missed record uid:', e.biowardrobeRecord.uid);
                return DDPConnection.call('satellite/projects/createSample', _sample);



            }, (biowardrobeRecord, sampleId, outerIndex, innerIndex) => ({ sampleId, biowardrobeRecord })),
            reduce((acc, val) => {
                Log.info(`Update sample: ${val.sampleId} `);

                Samples.update({ _id: val.sampleId }, val.biowardrobeRecord.new_sample, { upsert: true });
                Samples.update({ _id: val.sampleId }, {
                    $set: {
                        biowardrobe_import: {
                            sample_id: val.biowardrobeRecord.sample.id,
                            sample_uid: val.biowardrobeRecord.sample.uid,
                            egroup_id: val.biowardrobeRecord.sample.egroup_id
                        }
                    }
                }, { upsert: true });
                return { count: acc['count'] + 1, message: 'Samples finished' } as any;
            }, { count: 0, message: 'Samples finished' } as any),
            catchError((e) => of({ error: true, message: `Samples import: ${e}` }))
        );
    }
}


function fetch_cwls(){
    const gitRepo = Meteor.settings['git'];
    if (gitRepo && gitRepo['path'] && gitRepo['url']) {
        WorkflowsGitFetcher.getWorkflows(gitRepo['url'], gitRepo['path'], gitRepo['branch'], gitRepo['workflowsDir'])
            .then(() => {
                CWLCollection._ensureIndex({ "git.path": 1 });
                CWLCollection._ensureIndex({ "git.remote": 1 });
                Samples._ensureIndex({ "date.modified": 1 });
            })
            .catch((e) => {
                Log.error(e);
            });
    }
}

function get_sync_type() {
    if (!Meteor.settings.rc_server) {
        fetch_cwls();
        return of(1);
    } else {
        return connection.sync$;
    }
}


Meteor.startup(() => {
    if (Meteor.settings['biowardrobe'] && Meteor.settings['biowardrobe']['db']) {

        Labs._ensureIndex({ "owner._id": 1 }, { unique: true });
        Labs._ensureIndex({ "biowardrobe_import.laboratory_id": 1 });
        Samples._ensureIndex({ "biowardrobe_import.sample_uid": 1 });
        Meteor.users._ensureIndex({ "biowardrobe_import.laboratory_id": 1 });

        get_sync_type().pipe(
            switchMap((v) => {
                if (!v) {
                    Log.debug("V is not defined");
                    return of(null)
                }
                return of(
                    BioWardrobe.getWorkers(),
                    BioWardrobe.getLaboratories(),
                    BioWardrobe.getProjects(),
                    BioWardrobe.getProjectShares(),
                    BioWardrobe.getSamples()
                ).pipe(concatAll())
            })
            ).subscribe((c) => {
            if (c) {
                Log.debug("Sync stream, subscribed:", c);
                Log.info("No project no Laboratories:", _.keys(_laboratories));
            }
        });
    }
});