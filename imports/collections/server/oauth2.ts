import { Mongo } from 'meteor/mongo';

// export const AccessTokens: any = new Mongo.Collection('oauth_access_tokens', {connection:null});
// export const RefreshTokens: any = new Mongo.Collection('oauth_refresh_tokens', {connection:null});
// export const AuthCodes: any = new Mongo.Collection('oauth_auth_codes', {connection:null});

export const AccessTokens: any = new Mongo.Collection('oauth_access_tokens');
export const RefreshTokens: any = new Mongo.Collection('oauth_refresh_tokens');
export const AuthCodes: any = new Mongo.Collection('oauth_auth_codes',);


AccessTokens.deny({
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


RefreshTokens.deny({
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


AuthCodes.deny({
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