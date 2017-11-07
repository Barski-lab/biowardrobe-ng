import { Meteor } from 'meteor/meteor';
import { chai } from 'meteor/practicalmeteor:chai'; // Assertion library
import { getCollectionParams } from './shared/filestorage'


describe('collections', function() {
    describe('shared', function() {
        describe('filestorage', function() {
            describe('#getCollectionParams()', function() {
                it('Read collection properties from settings', function () {
                    let settings = {"remotes": {
                                        "filestorage": {
                                            "collection": {
                                                "name": "file_storage",
                                                "nullConnection": false
                                            }
                                        }
                                    }
                    };
                    chai.assert.deepEqual(getCollectionParams("filestorage", "defaultName", true, settings), {name: "file_storage", nullConnection: false})
                });
                it("Use default collection properties if settings for correspondent remote module are absent", function () {
                    let settings = {"remotes": {
                        "remoteModule": {
                            "collection": {
                                "name": "file_storage",
                                "nullConnection": false
                            }
                        }
                    }
                    };
                    chai.assert.deepEqual(getCollectionParams("filestorage", "defaultName", true, settings), {name: "defaultName", nullConnection: true})
                });
                it("Use default collection properties if settings includes not complete collection information", function () {
                    let settings = {"remotes": {
                        "filestorage": {
                            "collection": {
                                "name": "file_storage"
                            }
                        }
                    }
                    };
                    chai.assert.deepEqual(getCollectionParams("filestorage", "defaultName", true, settings), {name: "defaultName", nullConnection: true})
                });
            });
        });
    });
});