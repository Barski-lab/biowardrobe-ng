import { Meteor } from 'meteor/meteor';

import { Log } from '../modules/logger';
import { Samples, Projects } from '../../collections/shared';


const samplesPublishFields = {
    fields: {
        biowardrobe_import: 0
    }
};

Meteor.publish('samples/get', function (param) {
    let selectedSamples = [];
    if (this.userId) {
        // let currentUser = Meteor.sers.findOne({_id: this.userId});
        // if (currentUser.projects){
        //     Projects.find({_id: {$in: currentUser.projects}}).forEach(project => {
        //         if(project.samples){
        //             project.samples.forEach(sampleId => {
        //                     if (selectedSamples.indexOf(sampleId) === -1) {
        //                         selectedSamples.push(sampleId)
        //                     }
        //                 }
        //             )
        //         }
        //     });
        // }
        // Log.debug("Selected sample Ids", selectedSamples);
        // return Samples.find({_id: {$in: selectedSamples} }, samplesPublishFields);
        return Samples.find(param, samplesPublishFields);
    } else {
        this.ready();
    }
});

