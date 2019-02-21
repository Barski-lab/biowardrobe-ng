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

        Log.debug("Load workflows from Git Repository:",
            "\n  URL:          ", gitURL,
            "\n  local path:   ", gitPath,
            "\n  branch:       ", gitBranch,
            "\n  workflows dir:", workflowsDir);


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

        const workflows = await nodegit.Clone(gitURL, gitPath, cloneOptions)
            .catch((e) => {
                Log.debug("Failed to clone workflows from", gitURL, e);
                return cloneErrorHandler(gitPath)
            })
            .then((repo) => {
                Log.debug("Switch to branch", gitBranch);
                return repo.getBranchCommit(gitBranch);                    // What if branch doesn't exist?
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

    static expandRun(dataObj, basedir){
        if (dataObj.class == "Workflow") {
            Object.keys(dataObj.steps).forEach((key) => {
                if (typeof dataObj.steps[key].run === "string"){
                    let absRunPath = path.join(basedir, dataObj.steps[key].run);
                    dataObj.steps[key].run = safeLoad(fs.readFileSync(absRunPath));
                    WorkflowsGitFetcher.expandRun(dataObj.steps[key].run, path.dirname(absRunPath))
                }
            });
        }
    }

    static parseWorkflow(workflowEntry, latestCommit, gitUrl, gitPath) {

        const workflowRawData = Promise.await(workflowEntry.getBlob()).toString();
        const workflowSerializedData = safeLoad(workflowRawData);
        const workflowPath = workflowEntry.path();
        const sha = latestCommit.sha();

        WorkflowsGitFetcher.expandRun(workflowSerializedData, path.dirname(path.join(gitPath, workflowPath)));

        // fs.writeFile(path.join("/temp", workflowPath), JSON.stringify(workflowSerializedData, null, 4));

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
                "local": gitPath
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

    }

}