import { Mongo } from 'meteor/mongo';

export interface DownloadType {
    "_id"?: string;
    "uri": string;
    "path": string;
    "header": string;
    "sampleId": string;
    "projectId": string;
    "userId": string;
    "fileId": string;
    "inputKey": string;
    "token": string;
    "downloaded": boolean;
    "downloadId"?: string;
    "error"?: string;
    "masterSynced"?: boolean;
}

export const Downloads = new Mongo.Collection<DownloadType>('downloads');

Downloads.deny({
    insert: function () {
        return true;
    },
    update: function () {
        return true;
    },
    remove: function () {
        return true;
    }
});
