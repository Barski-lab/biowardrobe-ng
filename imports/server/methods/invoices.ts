import { Meteor } from 'meteor/meteor';
import { Log } from '../modules/logger';
import { BioWardrobe } from '../modules/biowardrobe-import/import'

Meteor.methods({

    "invoices/create": function (date) {
        if (!this.userId){
            throw new Meteor.Error(403, 'User not found');
        }
        Log.debug("Create invoice for", date);
        BioWardrobe.getInvoices(new Date(date));
    }

});