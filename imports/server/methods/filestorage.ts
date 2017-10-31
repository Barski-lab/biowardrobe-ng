import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { FileStorage, AccessTokens } from '../../collections';
import { Log } from '../modules/logger';
import { connection } from '../modules/ddpconnection';

const path = require('path');

let FileStoragePublicFields = {
    userId: 1,
    files: 1
};


// const promise = function createPromise (){
//     return new Promise((resolve, reject) => {
//         Meteor.setTimeout(() => {
//             resolve("Promise");
//         }, 5000)
//     })
// };

Meteor.methods({

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
                func: "getFileList",
                params: {login: moduleSettings.auth["login"], pass: moduleSettings.auth["pass"]}
            };
            Log.debug ("callModuleFunc", request);
            return connection.callModuleFunc(request);
        } else {
            Log.debug ("Return from collection", userAccessToken.userId);
            return FileStorage.findOne({'userId': userAccessToken.userId}, {fields: FileStoragePublicFields});
        }
    }
});