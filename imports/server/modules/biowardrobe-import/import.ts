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
const path = require("path");

// delete Package.webapp.main;

let excluded_laboratories = {};

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
                    if (!user["biowardrobe_import"]) {
                        return of(user['_id']);
                    } else {
                        return of(null);
                    }
                }, (biowardrobeRecord, userId, outerIndex, innerIndex) => ({userId, biowardrobeRecord})),
                filter(_ => _.userId),
                reduce((acc, val) => {
                    const w = val.biowardrobeRecord;
                    // TODO: check users email, if not exist add
                    Meteor.users.update({_id: val.userId}, {
                        $set: {
                            biowardrobe_import: {
                                laboratory_id: w['laboratory_id'],
                                admin: w['admin'],
                                laboratory_owner: w['changepass'],
                                synchronized: !!Meteor.settings.rc_server
                            }
                        }
                    }, {upsert: true});
                    return {count: acc['count'] + 1, message: 'Users import complete'} as any;
                }, {count: 0, message: 'Users import complete'} as any),
                catchError((e) => of({error: true, message: `Create user: ${e}`}))
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
                                {'biowardrobe_import.laboratory_id': l.id},
                                {'biowardrobe_import.laboratory_owner': 1}
                            ]
                        });
                    if (!user) {
                        return of(null);
                    }

                    const lab = Labs.findOne({"owner._id": user._id});
                    if (!lab) {
                        if (!Meteor.settings.rc_server) {
                            const uo: any = {
                                name: l.name,
                                description: l.description,
                                owner: {
                                    _id: user._id,
                                    lastName: user.profile.lastName,
                                    firstName: user.profile.firstName
                                }
                            };
                            return of(Labs.insert(uo));
                        } else {
                            return DDPConnection.call('satellite/accounts/createLab', user._id, l.name, l.description);
                        }
                    }
                    return of(null)
                }, (biowardrobeRecord, labId, outerIndex, innerIndex) => ({labId, biowardrobeRecord})),
                filter(_ => !!_.labId),
                reduce((acc, val) => {
                    Labs.update({_id: val.labId}, {
                        $set: {
                            biowardrobe_import: {
                                laboratory_id: val.biowardrobeRecord.id,
                                synchronized: !!Meteor.settings.rc_server
                            }
                        }
                    }, {upsert: true});
                    return {count: acc['count'] + 1, message: 'Laboratories import complete'} as any;
                }, {count: 0, message: 'Laboratories import complete'} as any),
                catchError((e) => of({error: true, message: `Create laboratory: ${e}`}))
            );
    }


    /**
     * Assign users to the existent laboratories
     * @returns {Observable<number>}
     */
    static assignWorkersToLaboratories (){
        Meteor.users.find().forEach((currentUser: any) => {
            if (currentUser.biowardrobe_import && currentUser.biowardrobe_import.laboratory_id){
                const lab: any = Labs.findOne({"biowardrobe_import.laboratory_id": currentUser.biowardrobe_import.laboratory_id});
                if (lab) {
                    Meteor.users.update( {_id: currentUser._id }, {"$addToSet":{"laboratories":lab._id}});
                }
            }
        });
        return of(1);
    }

    /**
     * As long as projects is the central part of the system (not laboratories like it was before),
     * we need to specify which user has access to which project. Originally all the laboratory's members had
     * access to all its projects. Therefore we need to iterate over all users; then check, if current user belongs to any
     * of the laboratories; if yes, iterate over them and for every laboratory find projects associated with it;
     * then add these projects to the current user.
     */
    static assignProjectsToWorkers() {
        Meteor.users.find().forEach((currentUser: any) => {
            if (currentUser.laboratories){
                currentUser.laboratories.forEach(laboratory => {
                    let projectIds = Projects
                        .find({"labs": {$elemMatch: {"_id": laboratory._id}}})
                        .forEach((project: any) => {
                            Meteor.users.update( {_id: currentUser._id }, {"$addToSet":{"projects": project._id}});
                        });

                })
            }
        });
        return of(1);
    }

    /**
     * For every sample imported from BioWardrobe DB we have the projectId it belongs too.
     * Update Projects with the list of sample ids
     */
    static assignSamplesToProjects() {
        Samples.find().forEach((sample: any) => {
            if (sample.projectId){
                Projects.update({_id: sample.projectId}, {"$addToSet":{"samples": sample._id}});
            }
        });
        return of(1);
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
                    const project = Projects.findOne({"biowardrobe_import.project_id": p.id});
                    const lab: any = Labs.findOne({"biowardrobe_import.laboratory_id": p.laboratory_id});
                    if (!project && lab) {
                        if (!Meteor.settings.rc_server) {
                            const cwlIds = CWLCollection.find({}, {fields: {_id: 1}}).fetch();
                            const projectId = Projects.insert(
                                {
                                    "name": p['name'],
                                    "description": p['description'] || "",
                                    "labs": [
                                        {
                                            "_id": lab['_id'],
                                            "name": lab['name'],
                                            "main": true
                                        }
                                    ],
                                    "modified": Date.now() / 1000.0,
                                    "cwl": cwlIds
                                });
                            return of(projectId);
                        } else {
                            Log.error(`Add project: ${p.name} to the lab ${lab.name}`);
                            const description = p['description'] || "";
                            return DDPConnection.call('satellite/projects/createProject',
                                {_id: lab['_id'], name: lab['name'], main: true},
                                {name: p['name'], description: description});
                        }
                    }
                    return of(null);
                }, (biowardrobeRecord, projectId, outerIndex, innerIndex) => ({projectId, biowardrobeRecord})),
                filter(_ => !!_.projectId),
                reduce((acc, val) => {
                    Projects.update({_id: val.projectId}, {
                        $set: {
                            biowardrobe_import: {
                                project_id: val.biowardrobeRecord.id,
                                synchronized: !!Meteor.settings.rc_server
                            }
                        }
                    }, {upsert: true});
                    return {count: acc['count'] + 1, message: 'Projects import complete'} as any;
                }, {count: 0, message: 'Projects import complete'} as any),
                catchError((e) => of({error: true, message: `Create project: ${e}`}))
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
                const project: any = Projects.findOne({"biowardrobe_import.project_id": p.egroup_id}); // Projects now!
                const lab: any = Labs.findOne({"biowardrobe_import.laboratory_id": p.laboratory_id});
                if (project && lab) {
                    if (!project.labs.find((l) => l._id === lab._id)) {
                        const l_obj = {
                            _id: lab._id,
                            name: lab.name,
                            main: false
                        };

                        // Log.debug('Giving access to a project for a lab :', project._id, l_obj);
                        return {count: acc['count'] + 1, message: 'Access to projects for labs complete'} as any;
                    }
                } else {
                    // Log.error('Lab or project does not exist!', p, {project: !!project, lab: !!lab});
                }
                return {count: acc['count'], message: 'Access to projects for labs complete'} as any;
            }, {count: 0, message: 'Access to projects for labs complete'} as any),
            catchError((e) => of({error: true, message: `Access to a project for a lab: ${e}`}))
        );
    }

    static getSamples() {
        return BioWardrobeMySQL.getExperiments().pipe(

            switchMap((experimentList) => of(...experimentList[0])),

            mergeMap((experiment) => {
                if (Samples.findOne({'biowardrobe_import.exp_uid': experiment.uid})) {
                    return of(null)
                }

                const _settings = {
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

                const BOWTIE_INDICES = "bowtie";
                const STAR_INDICES = "STAR";
                const ANNOTATIONS = "annotations";
                const CHR_LENGTH_GENERIC_TSV = "chrNameLength.txt";
                const ANNOTATION_GENERIC_TSV = "refgene.tsv";

                experiment = {
                    ...experiment,
                    "pair": experiment['etype'].includes('pair'),
                    "dUTP": experiment['etype'].includes('dUTP'),
                    "forcerun": experiment['forcerun'] === 1,
                    "spike": experiment['genome'].includes('spike'),
                    "force_fragment_size": experiment['force_fragment_size'] === 1,
                    "broad_peak": experiment['broad_peak'] === 2,
                    "remove_duplicates": experiment['remove_duplicates'] === 1,
                    "params": experiment['params'] || '{}',
                    "raw_data": [_settings['wardrobe'], _settings['preliminary']].join('/').replace(/\/\//g, '/'),
                    "upload": [_settings['wardrobe'], _settings['upload']].join('/').replace(/\/\//g, '/'),
                    "indices": [_settings['wardrobe'], _settings['indices']].join('/').replace(/\/\//g, '/'),
                    "threads": _settings['maxthreads'],
                    "experimentsdb": _settings['experimentsdb'],
                };
                experiment = {
                    ...experiment,
                    "fastq_file_upstream": ['file:/', experiment["raw_data"], experiment["uid"], experiment["uid"] + '.fastq.bz2'].join('/'),
                    "fastq_file_downstream": ['file:/', experiment["raw_data"], experiment["uid"], experiment["uid"] + '_2.fastq.bz2'].join('/'),
                    "star_indices_folder": ['file:/', experiment["indices"], STAR_INDICES, experiment["findex"]].join('/'),
                    "bowtie_indices_folder": ['file:/', experiment["indices"], BOWTIE_INDICES, experiment["findex"]].join('/'),
                    "bowtie_indices_folder_ribo": ['file:/', experiment["indices"], BOWTIE_INDICES, experiment["findex"] + "_ribo"].join('/'),
                    "chrom_length": ['file:/', experiment["indices"], BOWTIE_INDICES, experiment["findex"], CHR_LENGTH_GENERIC_TSV].join('/'),
                    "annotation_input_file": ['file:/', experiment["indices"], ANNOTATIONS, experiment["findex"], ANNOTATION_GENERIC_TSV].join('/'),
                    "exclude_chr": experiment['spike'] ? "control" : "",
                    "output_folder": [experiment["raw_data"], experiment["uid"]].join('/'),
                    "control_file": experiment['control_id'] ? [experiment["raw_data"], experiment["control_id"], experiment["control_id"] + '.bam'].join('/') : ""
                };
                let expInput = JSON.parse(
                    Mustache.render(
                        experiment['template'].replace(/{{/g, '<<').replace(/}}/g, '>>').replace(/{/g, '{{{').replace(/}/g, '}}}'),
                        experiment).replace(/<</g, '{').replace(/>>/g, '}'),
                    (key, value) => {
                        if (value === "false") {
                            return false;
                        }
                        if (value === "true") {
                            return true;
                        }
                        return value;
                    });
                if (!experiment['control_file']) {
                    delete (expInput['control_file']);
                }
                experiment['inputs'] = expInput;

                let discardKey = "discard_this_key";
                let expParams = experiment['params'].replace(/http:\/\/commonwl\.org\/cwltool#generation|http:\\\/\\\/commonwl.org\\\/cwltool#generation/g, discardKey);
                experiment['outputs'] = cleanCwlOutputs(JSON.parse(expParams), discardKey);

                const expProject = Projects.findOne({"biowardrobe_import.project_id": experiment.egroup_id});
                const expLaboratory = Labs.findOne({"biowardrobe_import.laboratory_id": experiment.laboratory_id});
                if (!expProject || !expLaboratory) {
                    excluded_laboratories[experiment.laboratory_id] = {egroup_id: experiment.egroup_id, laboratory_id: experiment.laboratory_id};
                    return of(null);
                }
                experiment['project'] = expProject;
                experiment['laboratory'] = expLaboratory;

                experiment["metadata"] = {
                    "cells": experiment["cells"],
                    "conditions": experiment["conditions"],
                    "alias": experiment["name4browser"],
                    "notes": experiment["notes"] || "",
                    "protocol": experiment["protocol"] || "",
                    "grouping": experiment["groupping"] || ""
                };

                let cwlPath = "workflows/" + experiment["workflow"];
                if (Meteor.settings['git'] && Meteor.settings['git']["workflowsDir"]){
                    cwlPath = path.join(Meteor.settings['git']["workflowsDir"], experiment["workflow"]);
                }
                experiment["cwl"] = CWLCollection.findOne({"git.path": cwlPath});
                if (!experiment["cwl"]) { // !e['cwl']._id
                    return of(null);
                }



                // Add updstream
                const _upstream_data = Samples.findOne(
                    {
                        $and: [
                            { "projectId": "Mrx3c92PKkipTBMsA" }, // Default project for all precomputed data
                            // { "cwlId": _upstream_id },
                            { "inputs.genome": experiment['db'] }
                        ]
                    } as any);
                experiment['upstreams'] = { 'genome_indices': _upstream_data };

                if (experiment['etype'].includes('RNA')) {

                    experiment['pie'] = {
                        colors: ['#b3de69', '#99c0db', '#fb8072', '#fdc381'],
                        data: [
                            ['Transcriptome', experiment['tagsused']],
                            ['Multi-mapped', experiment['tagssuppressed']],
                            ['Unmapped', experiment['tagstotal'] - experiment['tagsmapped'] - experiment['tagssuppressed']],
                            ['Outside annotation', experiment['tagsmapped'] - experiment['tagsused']]
                        ]
                    };
                } else {

                    experiment["metadata"] = {
                        ...experiment["metadata"],
                        "antibody": (experiment["antibody"] || "").trim(),
                        "catalog": (experiment["antibodycode"] || "").trim()
                    };

                    experiment['pie'] = {
                        colors: ['#b3de69', '#99c0db', '#fb8072', '#fdc381'],
                        data: [
                            ['Mapped', experiment['tagsused']],
                            ['Multi-mapped', experiment['tagssuppressed']],
                            ['Unmapped', experiment['tagstotal'] - experiment['tagsmapped'] - experiment['tagssuppressed']],
                            ['Duplicates', experiment['tagsmapped'] - experiment['tagsused']]
                        ]
                    };
                }

                const expUser = Meteor.users.findOne({'emails.address': experiment['email'].toLowerCase()});

                if (expUser) {
                    experiment['author'] = `${expUser.profile.lastName}, ${expUser.profile.firstName}`;
                    experiment['userId'] = expUser._id;
                } else {
                    experiment['author'] = `${experiment['laboratory'].owner.lastName}, ${experiment['laboratory'].owner.firstName}`;
                    if (!experiment['laboratory'].owner) {
                        Log.error(experiment['laboratory']);
                    }
                    experiment['userId'] = experiment['laboratory'].owner._id;
                }
                return of(experiment);
            },
                (biowardrobeRecord, sample, outerIndex, innerIndex) => ({ sample, biowardrobeRecord })),
            filter((e) => {
                const exp = e.sample;
                return exp && exp['cwl'] && exp['cwl']._id && exp['project']._id && exp['params'] && exp['params']['bambai_pair']; // && exp['etype'].includes('RNA')
            }),
            mergeMap((e) => {
                const experiment = e.sample;
                let sample = {
                    "userId": experiment['userId'],
                    "author": experiment['author'],
                    "cwlId": experiment['cwl']._id,
                    "projectId": experiment['project']._id,
                    "date": {
                        "created": new Date(experiment['dateadd']),
                        "analyzed": new Date(experiment['dateanalyzed']),
                        "analyse_start": new Date(experiment['dateanalyzes']),
                        "analyse_end": new Date(experiment['dateanalyzee']),
                    },
                    "metadata": experiment['metadata'],
                    "upstream": experiment['upstreams'],
                    "inputs": experiment['inputs'],
                    "outputs": experiment['outputs'],
                    "preview": {
                        "position1": experiment['metadata']['cells'],
                        "position2": experiment['metadata']['alias'],
                        "position3": experiment['metadata']['conditions'],
                        "visualPlugins": [
                            { "pie": experiment['pie'] }
                        ]
                    }
                };
                // experiment.biowardrobeRecord["new_sample"] = sample;

                if (!Meteor.settings.rc_server) {
                    return of(Samples.insert(sample));
                } else {
                    return DDPConnection.call('satellite/projects/createSample', sample);
                }
            }, (experiment, sampleId, outerIndex, innerIndex) => ({sampleId, experiment})),

            reduce((acc, val) => {
                Log.info(`Update sample: ${val.sampleId} `);

                // Samples.update({ _id: val.sampleId }, val.experiment.new_sample, { upsert: true });
                Samples.update({ _id: val.sampleId }, {
                    $set: {
                        biowardrobe_import: {
                            exp_id: val.experiment.id,
                            exp_uid: val.experiment.uid,
                            egroup_id: val.experiment.egroup_id,
                            synchronized: !!Meteor.settings.rc_server
                        }
                    }
                }, {upsert: true});
                return {count: acc['count'] + 1, message: 'Samples finished'} as any;
            }, {count: 0, message: 'Samples finished'} as any),
            catchError((e) => of({error: true, message: `Samples import: ${e}`}))
        );
    }
}

function cleanCwlOutputs(inputObj, excludeKey) {
    let outputObj = {};

    let returnUnchanged = Match.test(
        inputObj,
        Match.OneOf(
            String,
            [String],
            Number,
            [Number],
            Boolean,
            [Boolean],
            Date,
            [Date],
            null
        )
    );

    if (returnUnchanged) {
        return inputObj;
    }

    for (let key of Object.keys(inputObj)) {
        check(key, String);
        if (key.indexOf(excludeKey) !== -1) {
            continue;
        }
        if (Array.isArray(inputObj[key])) {
            outputObj[key] = inputObj[key].map(item => cleanCwlOutputs(item, excludeKey));
        } else if (typeof inputObj[key] === 'object') {
            outputObj[key] = cleanCwlOutputs(inputObj[key], excludeKey);
        } else {
            check(inputObj[key], Match.OneOf(String, Number, Boolean, Date, null));
            outputObj[key] = inputObj[key];
        }
    }
    return outputObj;
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

        CWLCollection._ensureIndex({ "git.path": 1 });
        CWLCollection._ensureIndex({ "git.remote": 1 });
        Samples._ensureIndex({ "date.modified": 1 });

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
                    // BioWardrobe.assignWorkersToLaboratories(),
                    // BioWardrobe.assignProjectsToWorkers(),
                    BioWardrobe.getSamples(),
                    // BioWardrobe.assignSamplesToProjects()
                ).pipe(concatAll())
            })
            ).subscribe((c) => {
            if (c) {
                Log.debug("Sync stream, subscribed:", c);
                Log.info("No project no Laboratories:", excluded_laboratories);
            }
        });
    }
});