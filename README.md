# BioWardrobe NG
[![Build Status](https://travis-ci.org/Barski-lab/biowardrobe-ng.svg?branch=master)](https://travis-ci.org/Barski-lab/biowardrobe-ng)

## Ubuntu

**To build** relocatable `biowardrobe-ng.tar.gz` that can be run with PM2 on Ubuntu 18.04 run the following command.
   ```bash
   cd build-scripts
   ./pack_ubuntu.sh
   ```

**To run** relocatable `biowardrobe-ng.tar.gz` on clean Ubuntu 18.04 run the following commands.
   ```bash
   curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
   sudo apt-get install nodejs
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   npm install -g pm2
   cd ubuntu_post_build
   tar xzf biowardrobe-ng.tar.gz
   pm2 start ./configs/ecosystem.config.js
   ```

File with the **default configuration** `biowardrobe_ng_default_settings.json`
```json
{
    "defaultLocations": {
        "systemRoot": "./biowardrobe_ng_oauth"
    },
    "networkSettings": {
        "proxy": "",
        "noProxy": ""
    },
    "mongoSettings": {
        "port": 27017,
        "collection": "biowardrobe_ng_oauth"
    },    
    "meteorSettings": {
        "name": "biowardrobe_ng",
        "base_url": "http://localhost:3069/",
        "port": 3069,
        "logLevel": "debug",
        "cors_package": true,
        "public":{
            "staleSessionInactivityTimeout": 300000,
            "staleSessionHeartbeatInterval": 120000,
            "staleSessionPurgeInterval": 60000,
            "staleSessionForceLogout": true,
            "staleSessionActivityEvents": "mousemove click keydown"
        }, 
        "accounts":{
            "sendVerificationEmail": false,
            "forbidClientAccountCreation": true,
            "loginExpirationInDays": 7
        },
        "SSL":{
            "key": "",
            "cert": "",
            "port": ""
        },
        "ldap": {},
        "oauth2server": {}
    }
}

```

**After updating** to the refactored version of BioWardrobe-NG the old `services.scidapsatellite` field in the `users` collection should be removed. Otherwise, users will get **Service scidapsatellite already registered [403]** error when trying to log in. To remove `services.scidapsatellite` do the following steps
1. Backup `scidap` database
    ```bash
    mongodump --archive --db scidap |7z a -si dump.7z
    ```
2. Run `mongo` shell and execute
    ```mongo
    db.users.find({"services.scidapsatellite": { $exists: true }})
    db.users.updateMany({}, {$unset: {"services.scidapsatellite": ""}})
    db.users.find({"services.scidapsatellite": { $exists: true }})
    ```
3. If something went wrong, restore from backup
    ```bash
    7z e -so dump.7z |mongorestore --archive --drop
    ```