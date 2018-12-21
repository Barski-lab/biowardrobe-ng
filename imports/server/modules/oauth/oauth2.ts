import { oauth2Model } from './oauth2model';
import { Log } from '../logger';

const express = require('express');
const bodyParser = require('body-parser');
const oauthServer = require('oauth2-server');


export class Auth2 {
    private app:any = undefined;
    private model = undefined;
    private oauthserver:any = undefined;
    private routes = undefined;

    constructor () {
        this.app = express();
        this.routes = express();
        this.model = new oauth2Model();
        this.oauthserver = new oauthServer({
            model: this.model,
            grants: Meteor.settings['oauth2server'].grant_type,
            debug: Meteor.settings['logLevel'] == "debug",
            accessTokenLifetime: Meteor.settings['oauth2server'].accessTokenLifetime,
            refreshTokenLifetime: Meteor.settings['oauth2server'].refreshTokenLifetime,
            authCodeLifetime: Meteor.settings['oauth2server'].authCodeLifetime
        });
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());
        this.initRoutes ();

        Meteor.setInterval(() => {
            oauth2Model.cleanUp();
        }, 1000*60*10);

        WebApp.rawConnectHandlers.use(this.app);
    }

    debugMiddle(req, res, next) {
        Log.debug('[OAuth2Server]:', req.method, req.url, req.body, req.user);
        return next();
    }

    initRoutes(){
        let self = this;

        this.app.all('/oauth/token',this.debugMiddle, this.oauthserver.grant());

        this.app.get('/oauth/authorize', this.debugMiddle, Meteor.bindEnvironment(
            (req, res, next) => {
                Log.debug('[OAuth2Server req]:', req.query);
                Log.debug('[OAuth2Server settings]:', oauth2Model.getClientFromSettings(req.query.client_id));
                if ( !oauth2Model.getClientFromSettings(req.query.client_id) ) {
                    return res.redirect('/oauth/error/404');
                }
                return next();
            }
        ));

        this.app.post('/oauth/authorize', this.debugMiddle, Meteor.bindEnvironment(
            (req, res, next) => {
                if (req.body.token == null) {
                    return res.sendStatus(401).send('No token');
                }
                var user = Meteor.users.findOne({
                    //@ts-ignore
                    'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(req.body.token)
                });
                if (!user) {
                    return res.sendStatus(401).send('Invalid token');
                }
                req.query.state = req.body.state + "&domain=" + Meteor.settings['oauth2server'].domain;
                req.user = {
                    id: user._id
                };
                return next();
            }
        ));

        this.app.post('/oauth/authorize', this.debugMiddle, this.oauthserver.authCodeGrant( Meteor.bindEnvironment(
            (req, next) => {
                return next(null, req.body.allow === 'yes', req.user.id, req.user);
            }
        )));

        this.app.post('/oauth/identity', this.debugMiddle, this.oauthserver.authorise(), Meteor.bindEnvironment(
            (req, res, next) => {

                var user = Meteor.users.findOne(req.user.id);
                Log.debug('[OAuth2Server] /oauth/identity in meteor :',req.method, req.url, req.body,req.user,user);

                if (!user) {
                    return res.sendStatus(401).send('Invalid token');
                }

                res.send({
                    id: user._id,
                    email: user.emails[0].address
                });
                return next(req,res,next);
            }));

        this.app.all('/oauth/logout',this.debugMiddle, this.oauthserver.authorise(), Meteor.bindEnvironment(
            (req, res, next) => {
                var user = Meteor.users.findOne(req.user.id);
                Log.debug('[OAuth2Server] /oauth/logout in meteor :',user);

                if (!user) {
                    return res.sendStatus(401).send('Invalid token');
                }

                Meteor.users.update({'_id':req.user.id},{$unset:{ 'services.resume.loginTokens':[]}});
                res.send({
                    'status': 'logout'
                });
                return next(req,res,next);
            })
        );

        this.app.use(this.routes);
        this.app.all('/oauth/*', this.oauthserver.errorHandler());
    }
}

export var oauth2server = new Auth2();