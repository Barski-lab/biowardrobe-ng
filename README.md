# BioWardrobe NG
[![Build Status](https://travis-ci.org/Barski-lab/biowardrobe-ng.svg?branch=master)](https://travis-ci.org/Barski-lab/biowardrobe-ng)

## Ubuntu

**To build** relocatable `tar.gz` that can be run with PM2 on Ubuntu 18.04 start a clean virtual machine with Ubuntu 18.04 and run the following commands.
   ```bash
   sudo apt-get install git g++ make curl
   curl https://install.meteor.com/ | sh 
   git clone --branch authOnly https://github.com/Barski-lab/biowardrobe-ng.git
   cd build-scripts
   ./build_ubuntu.sh
   ```

**To run** relocatable `tar.gz` on clean Ubuntu 18.04 run the following commands.
   ```bash
   curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
   sudo apt-get install nodejs
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   tar xzf biowardrobe-ng.tar.gz
   npm install -g pm2
   pm2 start ./configs/ecosystem.config.js
   ```