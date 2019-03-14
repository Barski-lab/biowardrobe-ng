import { Meteor } from 'meteor/meteor';
import { Match, check } from 'meteor/check';

import { safeLoad } from 'js-yaml';

import { Log } from '../modules/logger';
import { CWLCollection } from '../../collections/shared';

const nodegit = require("nodegit");
const path = require("path");
const fs = require('fs');

export class WorkflowsGitFetcher {

    static async getWorkflows(gitURL, gitPath, gitBranch="master", workflowsDir="/workflows") {

        let defaultRemoteName = "origin";

        Log.debug("Load workflows from Git Repository:",
            "\n  URL:          ", gitURL,
            "\n  local path:   ", gitPath,
            "\n  branch:       ", gitBranch,
            "\n  remote:       ", defaultRemoteName,
            "\n  workflows dir:", workflowsDir);

        let repository: any;   // to keep git repo between the promises
        let latestCommit: any;

        let cloneOptions = {
            fetchOpts: {
                callbacks: {
                    certificateCheck: function() {                        // To bypass GitHub certificate issue in OS X
                        return 1;
                    }
                }
            }
        };

        let cloneErrorHandler = function(localPath) {
            Log.debug("Open repository from local path", localPath);
            return nodegit.Repository.open(localPath);
        };

        Log.debug("Clone workflows from ", gitURL);
        const workflows = await nodegit.Clone(gitURL, gitPath, cloneOptions)
            .catch((e) => {
                Log.debug("Failed to clone workflows from", gitURL, e);
                return cloneErrorHandler(gitPath)
            })
            .then((repo) => {
                Log.debug("Fetch changes from remote", defaultRemoteName);
                repository = repo;
                return repo.fetch(defaultRemoteName);
            })
            .then(()=>{
                Log.debug("Merge fetched changes into", gitBranch);
                return repository.mergeBranches(gitBranch, defaultRemoteName + "/" + gitBranch);
            })
            .then((commitId)=>{
                Log.debug("Get latest commit", commitId);
                return repository.getCommit(commitId);
            })
            .then((commit) => {
                Log.debug("Get files tree from the latest commit");
                latestCommit = commit;
                return commit.getTree();
            })
            .then((tree) => {
                Log.debug("Get workflows directory", workflowsDir);
                return tree.getEntry(workflowsDir);
            })
            .then((entry) => {
                Log.debug("Get files tree from workflows directory");
                return entry.getTree();
            })
            .then((tree) => {
                Log.debug("Return all cwl files from workflows directory");
                return tree.entries().filter(w => w.isBlob() && w.name().endsWith('.cwl'));
            })
            .catch((e) => {
                Log.error(e);
            });

        workflows
            .forEach(entry => {
                WorkflowsGitFetcher.parseWorkflow(entry, latestCommit, gitURL, gitPath);
            });
    }

    static expandEmbedded(dataObj, basedir){
        if (_.isObject(dataObj) && !_.isArray(dataObj)){
            Object.keys(dataObj).forEach((key) => {
                if (key === "run" && typeof dataObj[key] === "string"){
                    let absRunPath = path.join(basedir, dataObj[key]);
                    dataObj[key] = safeLoad(fs.readFileSync(absRunPath));
                    WorkflowsGitFetcher.expandEmbedded(dataObj[key], path.dirname(absRunPath))
                } else if (key === "$import" && typeof dataObj[key] === "string"){
                    let absRunPath = path.join(basedir, dataObj[key]);
                    Object.keys(dataObj).forEach(k => delete dataObj[k]);
                    Object.assign(dataObj, safeLoad(fs.readFileSync(absRunPath)));
                    WorkflowsGitFetcher.expandEmbedded(dataObj, path.dirname(absRunPath))
                } else {
                    WorkflowsGitFetcher.expandEmbedded(dataObj[key], basedir)
                }
            });
        } else if (_.isArray(dataObj)){
            dataObj.forEach((item)=>{
                WorkflowsGitFetcher.expandEmbedded(item, basedir)
            })
        }
    }


    static removeMetadata(dataObj, excludeKeys:any = ["$namespaces", "$schemas", "doc"]){
        if (_.isObject(dataObj) && !_.isArray(dataObj)){
            Object.keys(dataObj).forEach((key) => {
                if (key === "$namespaces"
                    && _.isObject(dataObj[key]) && !_.isArray(dataObj[key])
                    && Object.keys(dataObj[key]).length > 0){

                    Object.keys(dataObj[key]).forEach((namespace)=>{
                        if (!excludeKeys.includes(namespace+":"))
                            excludeKeys.push(namespace+":");
                    });
                    delete dataObj[key];

                } else {

                    excludeKeys.forEach((itemPrefixToExclude) => {
                        if (key.startsWith(itemPrefixToExclude))
                            delete dataObj[key];
                    });

                }
                WorkflowsGitFetcher.removeMetadata(dataObj[key], excludeKeys);
            });
        } else if (_.isArray(dataObj)){
            dataObj.forEach((item)=>{
                WorkflowsGitFetcher.removeMetadata(item, excludeKeys);
            })
        }
    }


    static exportWorkflow(directory, prefix, workflowSerializedData){
        let base = path.join(directory, prefix);
        let dagTemplate = `
#!/usr/bin/env python3
from cwl_airflow_parser import CWLDAG, CWLJobDispatcher, CWLJobGatherer
dag = CWLDAG(cwl_workflow="${base+".cwl"}", dag_id="${prefix}")
dag.create()
dag.add(CWLJobDispatcher(dag=dag), to='top')
dag.add(CWLJobGatherer(dag=dag), to='bottom')
`;
        fs.writeFile(base+".cwl", JSON.stringify(workflowSerializedData, null, 4), {flag: "wx"}, function(err) {if (err) Log.debug("File already exists", base+".cwl")});
        fs.writeFile(base+".py", dagTemplate, {flag: "wx"}, function(err) {if (err) Log.debug("File already exists", base+".py")});
    }

    static parseWorkflow(workflowEntry, latestCommit, gitUrl, gitPath) {
        //@ts-ignore
        const workflowRawData = Promise.await(workflowEntry.getBlob()).toString();
        const workflowSerializedData = safeLoad(workflowRawData);
        const workflowPath = workflowEntry.path();
        const sha = latestCommit.sha();

        WorkflowsGitFetcher.expandEmbedded(workflowSerializedData, path.dirname(path.join(gitPath, workflowPath)));
        WorkflowsGitFetcher.removeMetadata(workflowSerializedData);

        let spliceIndex;
        if (gitUrl.endsWith('.git')) {
            spliceIndex = -4;
        } else if (gitUrl.endsWith('/')) {
            spliceIndex = -1;
        }

        const workflowURL = gitUrl.slice(0, spliceIndex) + "/blob/" + sha + "/" + workflowPath;

        let cwlUpdated = {
            "git": {
                "sha": sha,
                "remote": gitUrl,
                "path": workflowPath,
                "local_path": gitPath
            },
            "date": {
                "updated": new Date()
            },
            "description": {
                "url": workflowURL,
                "version": sha,
                "label": workflowSerializedData["label"] || "",
                "doc": workflowSerializedData["doc"] || ""
            },
            "source": {
                "source": workflowRawData,
                "json": JSON.stringify(workflowSerializedData)
            }
        };

        let cwlOriginal: any = CWLCollection.findOne({
            $and: [
                { "git.remote": gitUrl },
                { "git.path": workflowPath }
            ]
        });

        let targetId = cwlOriginal ? cwlOriginal["_id"] : undefined;
        if (targetId) {
            cwlUpdated["date"]["created"] = new Date();
        }
        CWLCollection.update({ _id: targetId }, { $set: cwlUpdated }, { upsert: true });

        WorkflowsGitFetcher.exportWorkflow(Meteor.settings["airflow"]["dags_folder"], path.basename(workflowPath).replace(".cwl", "").replace(".", "_dot_")+"-"+sha, workflowSerializedData);
    }

}