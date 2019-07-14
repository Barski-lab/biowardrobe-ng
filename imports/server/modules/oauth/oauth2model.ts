import { Log } from '../logger';
import { AccessTokens, RefreshTokens, AuthCodes } from '../../../collections/server';


export class oauth2Model {


    static cleanUp (accessTokenLifetime?, refreshTokenLifetime?, authCodeLifetime?) {
        AccessTokens.remove({expires: { $lt: new Date() }});
        RefreshTokens.remove({expires: { $lt: new Date() }});
        AuthCodes.remove({expires: { $lt: new Date() }});
    }

    getAccessToken =  Meteor.bindEnvironment((bearerToken, callback) => {
            Log.debug('[OAuth2Server]: in getAccessToken (bearerToken:', bearerToken, ')');
            try {
                const token = AccessTokens.findOne({
                    accessToken: bearerToken
                });
                Log.debug('[OAuth2Server]: token: ',token);

                return callback(null, token);
            } catch (error) {
                return callback(error);
            }
        }
    );

    static getClientFromSettings(clientId) {
        return (Meteor.settings['oauth2server'].clients||[]).find((e: any) => e && e.clientId === clientId);
    }

    getClient = Meteor.bindEnvironment((clientId, clientSecret, callback) => {
            let clnt: any = oauth2Model.getClientFromSettings(clientId);
            Log.debug(`[OAuth2Server] in getClient (clientId: ${clientId}, clientSecret: ${clientSecret})`, clnt);
            if ( clnt &&
                ( clientSecret == null || clientSecret == "" || clnt.clientSecret == clientSecret )
            ) {
                Log.debug('[OAuth2Server] in getClient : client is found');
                return callback(null, clnt);
            }
            Log.debug('[OAuth2Server] in getClient : cannot find client');
            return callback("Couldn't find client");
        }
    );

    grantTypeAllowed = Meteor.bindEnvironment( (clientId, grantType, callback) => {
            let _allowed = Meteor.settings['oauth2server'].grant_type.includes(grantType);
            Log.debug('[OAuth2Server] in grantTypeAllowed : ',_allowed);
            return callback(false, _allowed);
        }
    );

    saveAccessToken = Meteor.bindEnvironment((token, clientId, expires, user, callback) => {
            Log.debug(`[OAuth2Server] in saveAccessToken (token: ${token}, clientId: ${clientId}, user: ${user}, expires: ${expires})`);
            try {
                const tokenId = AccessTokens.insert({
                    accessToken: token,
                    clientId: clientId,
                    userId: user.id,
                    expires: expires
                });
                return callback(null, tokenId);
            } catch (error) {
                return callback(error);
            }
        }
    );

    getAuthCode = Meteor.bindEnvironment( (authCode, callback) => {
            Log.debug('[OAuth2Server]', 'in getAuthCode (authCode: ' + authCode + ')');
            try {
                const code = AuthCodes.findOne({
                    "authCode": authCode
                });
                Log.debug('[OAuth2Server]: found authCode: ', code);
                return callback(null, code);
            } catch (error) {
                Log.debug('[OAuth2Server]: error: ', error);
                return callback(error);
            }
        }
    );

    saveAuthCode = Meteor.bindEnvironment( (code, clientId, expires, user, callback) => {
            Log.debug('[OAuth2Server] in saveAuthCode (code:', code, ', clientId:', clientId, ', expires:', expires, ', user:', user, ')');
            try {
                const codeId = AuthCodes.upsert({
                    authCode: code
                }, {
                    authCode: code,
                    clientId: clientId,
                    userId: user,
                    expires: expires
                });
                return callback(null, codeId);
            } catch (error) {
                return callback(error);
            }
        }
    );

    saveRefreshToken = Meteor.bindEnvironment( (token, clientId, expires, user, callback) => {
            Log.debug('[OAuth2Server] in saveRefreshToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
            try {
                const tokenId = RefreshTokens.insert({
                    refreshToken: token,
                    clientId: clientId,
                    userId: user.id,
                    expires: expires
                });
                return callback(null, tokenId);
            } catch (error) {
                return callback(error);
            }
        }
    );

    getRefreshToken = Meteor.bindEnvironment( (refreshToken, callback) => {
            Log.debug('[OAuth2Server] in getRefreshToken (refreshToken: ' + refreshToken + ')');
            try {
                const token = RefreshTokens.findOne({
                    refreshToken: refreshToken
                });
                return callback(null, token);
            } catch (error) {
                return callback(error);
            }
        }
    )
}



