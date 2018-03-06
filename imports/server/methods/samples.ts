import { Meteor } from 'meteor/meteor';
import { Match, check } from 'meteor/check';

import { Log } from '../modules/logger';
import { Samples, Drafts } from '../../collections/shared';
import { makeUpdateObject } from './lib'

Meteor.methods({
    "samples/create": function () {
        //TODO check all the things required to copy data from drafts
        if (!Throttle.checkThenSet(this.connection.clientAddress + '_samplesCreate', 2, 30000))
            throw new Meteor.Error(500, 'Please wait at least a half a minute to try again');

        let _c = Drafts.findOne({ formId: "cwlform", userId: this.userId });

        if ( !_c || !_c["fields"])
            throw new Meteor.Error(500, "Can't find draft record for user", this.userId);

        // Don't need it until the moment when we add functionality of Labs and Projects
        // let _project = Projects.findOne({_id: _c["fields"].projectId});
        // if ( !_project || !_project['labs'] || !_project['cwl'])
        //     throw new Meteor.Error(500, 'Cant find project', _c["fields"].projectId);
        //
        // if (!_project['cwl'].find(x => x._id == _c["fields"].cwlId))
        //     throw new Meteor.Error(500, 'Cant find cwl in the project', _c["fields"].cwlId);
        //
        // let labIdListFromProject = _.map(_project['labs'], function(lab){ return lab['_id']; });
        // let labIdListUserBelongs = Laboratories.getOwnedAndMember(this.userId, { fields: { _id: 1 } }).map(l => l['_id']);
        //
        // let haveRightToAddSample = _.find(_.intersection(labIdListFromProject,labIdListUserBelongs), (labId)=>{
        //     return Roles.userIsInRole(this.userId, ['Pi','postdoc', 'bioinformatician','owner', 'technician'], labId);
        // });
        //
        // if ( !Roles.userIsInRole(this.userId, ['admin'], Roles.GLOBAL_GROUP) && !haveRightToAddSample )
        //     throw new Meteor.Error(403, 'Access denied!');

        let c = {};

        c['userId'] = this.userId;
        c['date'] = { created: new Date() };
        c['cwl'] = _c["fields"];

        Log.debug('Create sample',c);

        Drafts.remove(_c['_id']);
        return Samples.insert(c);
    },

    "samples/upsert": function (sampleId, obj) {
        // TODO Check what will happen if I update the document with new user.id and put there some bad code
        if (!Throttle.checkThenSet(this.connection.clientAddress+'_samplesUpsert', 2, 2000)) {
            throw new Meteor.Error(500, 'Please wait at least 2s to try again');
        }

        if (!this.userId) throw new Meteor.Error(403, 'User not found');
        check(sampleId, String);
        check(obj, Object);

        let uo = makeUpdateObject(obj);
        Samples.update(
            { "userId": this.userId, "_id": sampleId },
            { $set: uo },
            { upsert: true });

        Log.debug("Sample is updated", sampleId, uo);
    }

});