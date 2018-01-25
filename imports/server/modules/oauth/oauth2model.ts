import { Log } from '../logger';
import { AccessTokens, RefreshTokens, AuthCodes } from '../../../collections/server';


export class oauth2Model {


    getAccessToken =  Meteor.bindEnvironment((bearerToken, callback) => {
            var e, token;
            Log.debug('[OAuth2Server]: in getAccessToken (bearerToken:', bearerToken, ')');
            try {
                token = AccessTokens.findOne({
                    accessToken: bearerToken
                });
                Log.debug('token',token);

                return callback(null, token);
            } catch (error) {
                e = error;
                return callback(e);
            }
        }
    );

    static getClientFromSettings(clientId) {
        return _.find(Meteor.settings['oauth2server'].clients,e => e.clientId === clientId)
    }

    getClient = Meteor.bindEnvironment((clientId, clientSecret, callback) => {
            Log.debug('[OAuth2Server]', 'in getClient (clientId:', clientId, ', clientSecret:', clientSecret, ')',oauth2Model.getClientFromSettings(clientId));
            let clnt:any = oauth2Model.getClientFromSettings(clientId);
            if ( clnt &&
                ( clientSecret == null || clientSecret == "" || clnt.clientSecret == clientSecret )
            ){
                Log.debug('[OAuth2Server] in getClient : client is found');
                return callback(null, clnt);
            }
            Log.debug('[OAuth2Server] in getClient : cannot find client');
            return callback("Couldn't find client");
        }
    );

    grantTypeAllowed = Meteor.bindEnvironment( (clientId, grantType, callback) => {
            var _allowed = _.indexOf( Meteor.settings['oauth2server'].grant_type, grantType ) > -1;
            Log.debug('[OAuth2Server] in grantTypeAllowed : ',_allowed);
            return callback(false, _allowed);
        }
    );

    saveAccessToken = Meteor.bindEnvironment((token, clientId, expires, user, callback) => {
            var e, tokenId;
            Log.debug('[OAuth2Server]', 'in saveAccessToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
            try {
                tokenId = AccessTokens.insert({
                    accessToken: token,
                    clientId: clientId,
                    userId: user.id,
                    expires: expires
                });
                return callback(null, tokenId);
            } catch (error) {
                e = error;
                return callback(e);
            }
        }
    );

    getAuthCode = Meteor.bindEnvironment( (authCode, callback) => {
            var code, e;
            Log.debug('[OAuth2Server]', 'in getAuthCode (authCode: ' + authCode + ')');
            try {
                code = AuthCodes.findOne({
                    "authCode": authCode
                });
                Log.debug('[OAuth2Server]: found authCode: ', code);
                return callback(null, code);
            } catch (error) {
                Log.debug('[OAuth2Server]: error: ', error);
                e = error;
                return callback(e);
            }
        }
    );

    saveAuthCode = Meteor.bindEnvironment( (code, clientId, expires, user, callback) => {
            var codeId, e;
            Log.debug('[OAuth2Server] in saveAuthCode (code:', code, ', clientId:', clientId, ', expires:', expires, ', user:', user, ')');
            try {
                codeId = AuthCodes.upsert({
                    authCode: code
                }, {
                    authCode: code,
                    clientId: clientId,
                    userId: user,
                    expires: expires
                });
                return callback(null, codeId);
            } catch (error) {
                e = error;
                return callback(e);
            }
        }
    );

    saveRefreshToken = Meteor.bindEnvironment( (token, clientId, expires, user, callback) => {
            var e, tokenId;
            Log.debug('[OAuth2Server] in saveRefreshToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
            try {
                return tokenId = RefreshTokens.insert({
                    refreshToken: token,
                    clientId: clientId,
                    userId: user.id,
                    expires: expires
                }, callback(null, tokenId));
            } catch (error) {
                e = error;
                return callback(e);
            }
        }
    );

    getRefreshToken = Meteor.bindEnvironment( (refreshToken, callback) => {
            var e, token;
            Log.debug('[OAuth2Server] in getRefreshToken (refreshToken: ' + refreshToken + ')');
            try {
                token = RefreshTokens.findOne({
                    refreshToken: refreshToken
                });
                return callback(null, token);
            } catch (error) {
                e = error;
                return callback(e);
            }
        }
    )
}



