const { getSettings, getRunConfiguration } = require('../utilities/configure');


const settings = getSettings();
module.exports = getRunConfiguration(settings);