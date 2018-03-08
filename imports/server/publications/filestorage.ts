import { Meteor } from 'meteor/meteor';

import { Log } from '../modules/logger';
import { FileStorage } from '../../collections/shared';


const fileStoragePublishFields = {
    fields: {
        userId: 1,
        timestamp: 1,
        active: 1,
        files: 1
    }
};

Meteor.publish('filestorage/get', function () {
    // Return only those document(s) where active is true (the file list is up to date) or where `active` field
    // is not present at all (FileStorage has not been automatically updated yet)
    if (this.userId) {
        return FileStorage.find( {'userId': this.userId, $or:[{"active": true},{"active":{$exists:false}}] }, fileStoragePublishFields);
    } else {
        this.ready();
    }
});