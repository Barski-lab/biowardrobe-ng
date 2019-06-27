import { Meteor } from 'meteor/meteor';
import '../imports/server';
import { setExtraUsers, configAccounts } from '../imports/server/modules/accounts'

const cors = require('cors');

Meteor.startup(() => {
    // Throttle.setMethodsAllowed(false);            // Disable client-side methods
    // if(Meteor.settings['logLevel'] == "debug") {
    //     Throttle.setDebugMode(true);              // Show debug messages
    // }

    // WebApp.connectHandlers.use(function(req, res, next) {
    //     res.setHeader("Access-Control-Allow-Origin", "*");
    //     // add headers
    //     res.setHeader('Access-Control-Allow-Headers', [
    //         'Accept',
    //         'Accept-Charset',
    //         'Accept-Encoding',
    //         'Accept-Language',
    //         'Accept-Datetime',
    //         'Authorization',
    //         'Cache-Control',
    //         'Connection',
    //         'Cookie',
    //         'Content-Length',
    //         'Content-MD5',
    //         'Content-Type',
    //         'Date',
    //         'User-Agent',
    //         'X-Requested-With',
    //         'Origin'
    //     ].join(', '));
    //     return next();
    // });

    if(Meteor.settings['cors']) {
        WebApp.rawConnectHandlers.use(function (req, res, next) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader('Access-Control-Allow-Headers', "*");
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
            return next();
        });
    }
    if(Meteor.settings['cors_package']) {
        WebApp.rawConnectHandlers.use(cors());
    }

    configAccounts();
    setExtraUsers();

});



