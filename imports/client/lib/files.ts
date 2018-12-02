import { FilesCollection } from 'meteor/ostrio:files';

export let FileUpload = new FilesCollection({
    collectionName: 'raw_data_files'
});
