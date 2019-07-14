import { Meteor } from 'meteor/meteor';

import '../imports/server';
import { setExtraUsers, configAccounts } from '../imports/server/modules/accounts'
import { Log } from '../imports/server/modules/logger';

const cors = require('cors');
const fs = require('fs');
const httpProxy = require('http-proxy');

Meteor.startup(() => {

    // Throttle.setMethodsAllowed(false);            // Disable client-side methods
    // if(Meteor.settings['logLevel'] == "debug") {
    //     Throttle.setDebugMode(true);              // Show debug messages
    // }


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

    if(Meteor.settings['SSL']) {

        const [,, host, targetPort] = Meteor.absoluteUrl().match(/([a-zA-Z]+):\/\/([\-\w\.]+)(?:\:(\d{0,5}))?/);

        let proxy = httpProxy.createServer({
            target: {
                host,
                port: process.env.PORT || 3000
            },
            ssl: {
                key: fs.readFileSync(Meteor.settings['SSL'].key, 'utf8'),
                cert: fs.readFileSync(Meteor.settings['SSL'].cert, 'utf8')
            },
            ws: true,
            xfwd: true
        }).listen(Meteor.settings['SSL'].port||targetPort);


        proxy.on("error", function(err) {
            Log.error("HTTP-PROXY NPM MODULE ERROR: ", err);
            return;
        });
    }

    configAccounts();
    setExtraUsers();

});



