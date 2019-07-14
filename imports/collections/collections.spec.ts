import { Meteor } from 'meteor/meteor';
// import { chai } from 'meteor/practicalmeteor:chai'; // Assertion library
// import { resetDatabase } from 'meteor/xolvio:cleaner';

// import { getCollectionParams } from './shared/filestorage'


describe('collections', function() {
    describe('shared', function() {
        describe('filestorage', function() {
            describe('#getCollectionParams()', function() {
                before(function() {
                    // resetDatabase();
                    Meteor.settings  = _.extend(Meteor.settings, {
                        "remotes": {
                            "filestorage": {
                                "collection": {
                                    "name": "file_storage",
                                    "nullConnection": false
                                }
                            }
                        }
                    });
                });

                it("Read collection's properties from settings", function () {
                    // chai.assert.deepEqual(getCollectionParams("filestorage", "defaultName", true), {name: "file_storage", nullConnection: false})
                });

                it("Use default collection's properties if remote module is not found", function () {
                    // chai.assert.deepEqual(getCollectionParams("absent_module", "defaultName", true), {name: "defaultName", nullConnection: true})
                });

                it("Use default collection's properties if settings include not complete information about collection", function () {
                    delete Meteor.settings.remotes.filestorage.collection.nullConnection;
                    // chai.assert.deepEqual(getCollectionParams("filestorage", "defaultName", true), {name: "defaultName", nullConnection: true})
                });

                after(function() {
                    delete Meteor.settings.remotes;
                    // resetDatabase();
                });
            });
        });
    });
});
