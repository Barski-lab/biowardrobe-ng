import { Meteor } from 'meteor/meteor';
import { Match, check } from 'meteor/check';

import { Log } from '../modules/logger';
import { Drafts } from '../../collections/shared';
import { makeUpdateObject } from './lib'

const DraftsAllowedFormIds = ['cwlform'];

Meteor.methods({
    'drafts/upsert'(formId, obj) {
        if (!Throttle.checkThenSet(this.connection.clientAddress+'_draftsUpsert', 2, 2000)) {
            throw new Meteor.Error(500, 'Please wait at least 2s to try again');
        }

        if (!this.userId) throw new Meteor.Error(403, 'User not found');
        check(formId, Match.Where(fid => _.contains(DraftsAllowedFormIds, fid)) );
        check(obj, Object); // Why do we need it?

        let uo = makeUpdateObject(obj, {}, 'fields');

        if(Object.keys(uo).length>0)
            Drafts.update(
                { userId: this.userId, formId: formId },
                { $set: uo },
                { upsert: true });

        Log.debug("Drafts are updated",formId, uo, obj);
    },

    'drafts/reset'(formId, obj) {
        if (!Throttle.checkThenSet(this.connection.clientAddress+'_draftsReset', 2, 2000)) {
            throw new Meteor.Error(500, 'Please wait at least 2s to try again');
        }

        if (!this.userId) throw new Meteor.Error(403, 'User not found');
        check(formId,Match.Where((fid) => _.contains(DraftsAllowedFormIds, fid)));
        check(obj,Object); // Why do we need it?

        let uo = makeUpdateObject(obj, {}, 'fields');

        Log.debug("reset drafts:",formId, uo, obj);
        Drafts.update(
            { userId: this.userId, formId: formId },
            { $set: {fields:{} } },
            { upsert: true });

        if(Object.keys(uo).length>0)
            Drafts.update(
                { userId: this.userId, formId: formId },
                { $set: uo },
                { upsert: true });
    }
});