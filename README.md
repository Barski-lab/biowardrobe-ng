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