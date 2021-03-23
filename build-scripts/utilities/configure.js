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
  settings.satelliteSettings.systemRoot = path.resolve(os.homedir(), settings.satelliteSettings.systemRoot);
  settings.defaultLocations = getDefaultLocations(settings);
  return settings;
}


function getDefaultLocations(settings){
  const defaultLocations = {};
  for (const [key, value] of Object.entries(settings.defaultLocations)) {
    defaultLocations[key] = path.resolve(settings.satelliteSettings.systemRoot, value)
  };
  return defaultLocations
}


function getMongodArgs(settings){
  const mongodArgs = [
    '--bind_ip', '127.0.0.1',
    '--port', settings.satelliteSettings.mongoPort,
    '--dbpath', settings.defaultLocations.mongodb
  ];
  return mongodArgs
}


function getSatelliteEnvVar(settings){
  let satelliteEnvVar = {
    PATH: settings.executables.pathEnvVar,
    MONGO_URL: `mongodb://localhost:${settings.satelliteSettings.mongoPort}/${settings.satelliteSettings.mongoCollection}`,
    ROOT_URL: settings.satelliteSettings.baseUrl,
    PORT: settings.satelliteSettings.port,
    // we need to re-evaluate meteorSettings, because on macOS rcServerToken was not loaded from the config file and therefore was not present when we run getSettings
    METEOR_SETTINGS: getMeteorSettings(settings),
    NODE_OPTIONS: '--trace-warnings --pending-deprecation'
  };
  if (settings.satelliteSettings.proxy) {
    satelliteEnvVar = {
      ...satelliteEnvVar,
      https_proxy: settings.satelliteSettings.proxy,
      http_proxy: settings.satelliteSettings.proxy,
      no_proxy: settings.satelliteSettings.noProxy || ''
    };
  };
  return satelliteEnvVar
}


function getMeteorSettings(settings){
  const meteorSettings = {
    ...settings.meteorSettings,
    base_url: settings.satelliteSettings.baseUrl,
    systemRoot: settings.satelliteSettings.systemRoot,
    logFile: path.resolve(settings.defaultLocations.satellite, 'satellite-service.log')
  };
  if (settings.satelliteSettings.sslCert && settings.satelliteSettings.sslKey && settings.satelliteSettings.sslPort) {
    meteorSettings['SSL'] = {
      'key': settings.satelliteSettings.sslKey,
      'cert': settings.satelliteSettings.sslCert,
      'port': settings.satelliteSettings.sslPort
    };
  }
  return meteorSettings;
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
    path.resolve(cwd, '../configs/default_settings.json')                  // default settings should be always present
  ];

  if (customLocation){
    settings_locations.unshift(customLocation);
  };

  // Load settings from the external file, add dynamically configured locations for executables
  const settings = {
    ...loadSettings(settings_locations),
    executables: {
      mongod: path.resolve(cwd, '../satellite/bin/mongod'),
      startSatellite: path.resolve(cwd, '../satellite/main.js'),
      pathEnvVar: `${ path.resolve(cwd, '../satellite/bin') }:/usr/bin:/bin:/usr/local/bin`
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
        name: 'satellite',
        script: settings.executables.startSatellite,
        interpreter: 'node',
        watch: false,
        exec_mode: 'fork_mode',
        cwd: settings.defaultLocations.satellite,
        env: getSatelliteEnvVar(settings)
      }
    ]
  };
  
  return configuration;
}


module.exports = {
  getSettings: getSettings,
  getRunConfiguration: getRunConfiguration
}