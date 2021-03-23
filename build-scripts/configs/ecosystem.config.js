const { getSettings, waitForInitConfiguration, getRunConfiguration } = require('../utilities/configure');


const settings = getSettings();
waitForInitConfiguration(settings);
module.exports = getRunConfiguration(settings);