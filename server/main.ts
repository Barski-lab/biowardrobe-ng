import { Meteor } from 'meteor/meteor';

import '../imports/server';
import { Log } from '../imports/server/modules/logger';

const cors = require('cors');
const fs = require('fs');
const httpProxy = require('http-proxy');


Meteor.startup(() => {

    if(Meteor.settings["cors"]) {
        WebApp.rawConnectHandlers.use(function (req, res, next) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader('Access-Control-Allow-Headers', "*");
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
            return next();
        });
    }

    if(Meteor.settings["cors_package"]) {
        let corsOptions = {
            origin: true,
            credentials: true,
            preflightContinue: true,
            optionsSuccessStatus: 204  // some legacy browsers (IE11, various SmartTVs) choke on 204
        }
        WebApp.rawConnectHandlers.use(cors(corsOptions));
    }

    if(Meteor.settings['SSL'] && Meteor.settings['SSL'].key && Meteor.settings['SSL'].cert && Meteor.settings['SSL'].port) {

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

});
