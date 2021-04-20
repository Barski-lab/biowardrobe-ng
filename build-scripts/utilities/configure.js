const path = require('path');
const fs = require('fs');
const os = require('os');
const process = require('process');


function loadSettings(settings_locations){
  for (location of settings_locations){
    try {
      settings = JSON.parse(fs.readFileSync(location));
      console.log(`Successfully loaded settings from ${location}`);
      break;
    } catch (e) {
      console.log(`Failed to load settings from ${location}`);
    }
  };
  settings.defaultLocations.systemRoot = path.resolve(os.homedir(), settings.defaultLocations.systemRoot);
  settings.defaultLocations.mongodb = path.resolve(settings.defaultLocations.systemRoot, "mongodb");
  settings.meteorSettings.logFile = path.resolve(settings.defaultLocations.systemRoot, 'biowardrobe_ng_service.log')
  return settings;
}


function getMongodArgs(settings){
  const mongodArgs = [
    '--bind_ip', '127.0.0.1',
    '--port', settings.mongoSettings.port,
    '--dbpath', settings.defaultLocations.mongodb
  ];
  return mongodArgs
}


function getBiowardrobeNgEnvVar(settings){
  let biowardrobeNgEnvVar = {
    PATH: settings.executables.pathEnvVar,
    MONGO_URL: `mongodb://localhost:${settings.mongoSettings.port}/${settings.mongoSettings.collection}`,
    ROOT_URL: settings.meteorSettings.base_url,
    PORT: settings.meteorSettings.port,
    METEOR_SETTINGS: settings.meteorSettings,
    NODE_OPTIONS: '--trace-warnings --pending-deprecation'
  };
  if (settings.networkSettings.proxy) {
    biowardrobeNgEnvVar = {
      ...biowardrobeNgEnvVar,
      https_proxy: settings.networkSettings.proxy,
      http_proxy: settings.networkSettings.proxy,
      no_proxy: settings.networkSettings.noProxy || ''
    };
  };
  return biowardrobeNgEnvVar
}


function createFolders(settings){
  /*
  Creates all required folders.
  */

  const folders = [
    ...Object.values(settings.defaultLocations)
  ]
  for (folder of folders) {
    try {
      fs.mkdirSync(folder, {recursive: true});
    } catch (e) {
      console.log(`Failed to create directory ${folder} due to ${e}`);
    }
  }
}


function getSettings(cwd, customLocation){
  /*
  Relative locations will be resolved based on __dirname if cwd was not provided.
  If customLocation is provided it have higher priority compared to other locations
  */
 
  cwd = cwd || __dirname;

  const settings_locations = [
    process.env.BIOWARDROBE_NG_SETTINGS,
    path.resolve(cwd, '../../biowardrobe_ng_settings.json'),
    path.resolve(os.homedir(), './.config/biowardrobe_ng/biowardrobe_ng_settings.json'),
    path.resolve(cwd, '../configs/biowardrobe_ng_default_settings.json')                  // default settings should be always present
  ];

  if (customLocation){
    settings_locations.unshift(customLocation);
  };

  // Load settings from the external file, add dynamically configured locations for executables
  const settings = {
    ...loadSettings(settings_locations),
    executables: {
      mongod: path.resolve(cwd, '../services/bin/mongod'),
      biowardrobeNg: path.resolve(cwd, '../services/main.js'),
      pathEnvVar: `${ path.resolve(cwd, '../services/bin') }:/usr/bin:/bin:/usr/local/bin`
    }
  }
  
  return settings;
}


function getRunConfiguration(settings){

  const configuration = {
    apps: [
      {
        name: 'mongod',
        script: settings.executables.mongod,
        args: getMongodArgs(settings),
        watch: false,
        exec_mode: 'fork_mode',
        cwd: settings.defaultLocations.mongodb
      },
      {
        name: 'biowardrobe_ng',
        script: settings.executables.biowardrobeNg,
        interpreter: 'node',
        watch: false,
        exec_mode: 'fork_mode',
        cwd: settings.defaultLocations.systemRoot,
        env: getBiowardrobeNgEnvVar(settings)
      }
    ]
  };
  
  return configuration;
}


module.exports = {
  getSettings: getSettings,
  createFolders: createFolders,
  getRunConfiguration: getRunConfiguration
}