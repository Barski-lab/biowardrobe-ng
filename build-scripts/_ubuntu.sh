#!/bin/bash

warn() { echo "$@" 1>&2; }


download_and_extract() {
  DOWNLOAD_URL=$1
  COMPRESSED_NAME=$2
  EXTRACTED_NAME=$3
  cd ${WORKDIR}
  echo "Processing link $DOWNLOAD_URL"
  if [ -e $COMPRESSED_NAME ]; then
    warn "File $COMPRESSED_NAME already exist. Skipping"
  else
    echo "Downloading $DOWNLOAD_URL"
    curl -L -O --fail $DOWNLOAD_URL
  fi
  if [ -e ${EXTRACTED_NAME} ]; then
    warn "Location $EXTRACTED_NAME already exist. Skipping"
  else
    echo "Extracting $COMPRESSED_NAME"
    tar -xvf $COMPRESSED_NAME > ${EXTRACTED_NAME}_extraction.log 2>&1
  fi
}


build_biowardobe_ng() {
  TEMP_PATH=$PATH
  PATH="${WORKDIR}/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"
  echo "Building biowardrobe-ng from $1"
  cd $1
  rm -rf node_modules
  npm install > ${WORKDIR}/npm_install.log 2>&1
  AOT=1 ROLLUP=0 meteor build --allow-superuser --directory "${SERVICES}" > ${WORKDIR}/biowardrobe_ng_build.log 2>&1 
  cd "${SERVICES}"
  mv bundle/* bundle/.node_version.txt .
  rm -rf bundle
  chmod -R u+w ${SERVICES}
  echo "Installing node modules"
  cd ${SERVICES}/programs/server
  npm install >> ${WORKDIR}/npm_install.log 2>&1
  cd ${WORKDIR}
  PATH=$TEMP_PATH
}


# Setting up package versions
UBUNTU_VERSION=${UBUNTU_VERSION:="18.04"}
NODE_VERSION=${NODE_VERSION:="12.21.0"}
MONGO_VERSION=${MONGO_VERSION:="4.2.10"}
BIOWARDROBE_NG_LOCAL_PATH="../"


# Preparing clean working directory
rm -rf ../ubuntu_post_build && mkdir -p ../ubuntu_post_build
rm -rf ../build_ubuntu && mkdir -p ../build_ubuntu/services/bin && cd ../build_ubuntu
WORKDIR=$(pwd)
SERVICES=${WORKDIR}/services


echo "Current configuration:"
echo "  UBUNTU_VERSION = ${UBUNTU_VERSION}"
echo "  NODE_VERSION = ${NODE_VERSION}"
echo "  MONGO_VERSION = ${MONGO_VERSION}"
echo "  WORKDIR = ${WORKDIR}"
echo "  SERVICES = ${SERVICES}"
echo "  BIOWARDROBE_NG_LOCAL_PATH = ${BIOWARDROBE_NG_LOCAL_PATH}"


echo "Installing dependencies"
apt-get update > /dev/null 2>&1
apt-get install git g++ make curl -y > /dev/null 2>&1
curl -s https://install.meteor.com/ | sh > /dev/null 2>&1


# Downloading Node
NODE_URL="https://nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
download_and_extract $NODE_URL node-v${NODE_VERSION}-linux-x64.tar.gz node-v${NODE_VERSION}-linux-x64
echo "Copying node-v${NODE_VERSION}-linux-x64/bin/node"
cp node-v${NODE_VERSION}-linux-x64/bin/node ${SERVICES}/bin/


# Downloadind and compiling biowardrobe-ng, installing node modules
build_biowardobe_ng ${BIOWARDROBE_NG_LOCAL_PATH}


# Downloading MongoDB
UBUNTU_VERSION_WITHOUT_DOT="${UBUNTU_VERSION//./}"
MONGO_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}.tgz"
download_and_extract $MONGO_URL mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}.tgz mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}
echo "Copying mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}/bin/mongod"
cp mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}/bin/mongod ${SERVICES}/bin/


# Moving installed programs to the ubuntu_post_build folder, copying configuration files and utilities. Compressing results
cd ${WORKDIR}
mv ${SERVICES} ../ubuntu_post_build
cd ../ubuntu_post_build
mkdir configs utilities
cp ../build-scripts/configs/ecosystem.config.js ./configs/
cp ../build-scripts/configs/biowardrobe_ng_default_settings.json ./configs/
cp ../build-scripts/utilities/configure.js ./utilities/
tar -czf biowardrobe-ng.tar.gz ./*
rm -rf services configs utilities