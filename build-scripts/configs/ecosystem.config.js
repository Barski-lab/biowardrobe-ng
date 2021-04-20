const { getSettings, createFolders, getRunConfiguration } = require('../utilities/configure');


const settings = getSettings();
createFolders(settings);
module.exports = getRunConfiguration(settings);