import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { FileStorage } from '../../collections/shared';
import { AccessTokens } from '../../collections/server';
import { Log } from '../modules/logger';
import { connection } from '../modules/ddpconnection';

const path = require('path');

let FileStoragePublicFields = {
    userId: 1,
    files: 1
};


Meteor.methods({
    // Probably will be deprecated. Method was previously used to get list of files from the satellite
    "satellite/filestorage/list": function (accessToken) {
        Log.debug ("Call satellite/filestorage/list with", accessToken);
        // if (!Throttle.checkThenSet(this.connection.clientAddress + '_satelliteFileStorageList', 2, 2000))
        //     throw new Meteor.Error(500, 'Please wait at least 2 seconds to try again');

        check(accessToken, String);

        let userAccessToken = AccessTokens.findOne({accessToken: accessToken});
        if (!userAccessToken)
            throw new Meteor.Error(403, 'Access denied!');

        let moduleId = path.basename(__filename).substring(0, path.basename(__filename).lastIndexOf("."));
        let moduleSettings = Meteor.settings.remotes ? Meteor.settings.remotes[moduleId] : null;
        if (moduleSettings && moduleSettings["auth"] && moduleSettings.auth["login"] && moduleSettings.auth["pass"]){
            let request = {
                type: moduleSettings["type"],
                moduleId: moduleId,
                func: "getFileList", // hardcoded, because we know that for satellite/filestorage/list we want to use getFileList
                params: {login: moduleSettings.auth["login"], pass: moduleSettings.auth["pass"]}
            };
            return connection.callModuleFunc(request)
                .then(
                    res => {
                        return Promise.resolve(_.extend(_.omit(res, 'cookies'),{'userId': userAccessToken.userId}));
                    }
                );
        } else {
            return FileStorage.findOne({'userId': userAccessToken.userId}, {fields: FileStoragePublicFields});
        }
    }
});