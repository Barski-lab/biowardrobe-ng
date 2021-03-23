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
  npm install > ${WORKDIR}/npm_install.log 2>&1
  AOT=1 ROLLUP=0 meteor build --directory "${SATDIR}" > ${WORKDIR}/biowardrobe_ng_build.log 2>&1 
  cd "${SATDIR}"
  mv bundle/* bundle/.node_version.txt .
  rm -rf bundle
  chmod -R u+w ${SATDIR}
  echo "Installing node modules"
  cd ${SATDIR}/programs/server
  npm install >> ${WORKDIR}/npm_install.log 2>&1
  cd ${WORKDIR}
  PATH=$TEMP_PATH
}


# Setting up package versions
NODE_VERSION="12.21.0"
MONGO_VERSION="4.2.10"
UBUNTU_VERSION="18.04"
BIOWARDROBE_NG_VERSION="authOnly"


# Loading variables from .env if provided
# Can be used for redefining package versions from above
if [ -e .env ]; then
  echo "Loading variables from .env"
  export $(egrep -v '^#' .env | xargs)
fi


# Preparing working directory
rm -rf ../ubuntu_post_build && mkdir -p ../ubuntu_post_build
mkdir -p ../build_ubuntu/satellite/bin && cd ../build_ubuntu
WORKDIR=$(pwd)
SATDIR=${WORKDIR}/satellite


# Downloading Node
if [ -e ${SATDIR}/bin/node ]; then
  warn "Node has been already copied. Skipping"
else
  NODE_URL="https://nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
  download_and_extract $NODE_URL node-v${NODE_VERSION}-linux-x64.tar.gz node-v${NODE_VERSION}-linux-x64
  echo "Copying node-v${NODE_VERSION}-linux-x64/bin/node"
  cp node-v${NODE_VERSION}-linux-x64/bin/node ${SATDIR}/bin/
fi


# Downloadind and compiling biowardrobe-ng, installing node modules
if [ -e ${SATDIR}/main.js ]; then
  warn "biowardrobe-ng has been already built. Skipping"
else
  # Downloading and building BioWardrobe-NG from the GitHub release/branch BIOWARDROBE_NG_VERSION
  BIOWARDROBE_NG_URL="https://github.com/Barski-lab/biowardrobe-ng/archive/${BIOWARDROBE_NG_VERSION}.tar.gz"
  download_and_extract $BIOWARDROBE_NG_URL ${BIOWARDROBE_NG_VERSION}.tar.gz biowardrobe-ng-${BIOWARDROBE_NG_VERSION}
  build_biowardobe_ng biowardrobe-ng-${BIOWARDROBE_NG_VERSION}
fi


# Downloading MongoDB
if [ -e ${SATDIR}/bin/mongod ]; then
  warn "Mongod has been already copied. Skipping"
else
  UBUNTU_VERSION_WITHOUT_DOT="${UBUNTU_VERSION//./}"
  MONGO_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}.tgz"
  download_and_extract $MONGO_URL mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}.tgz mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}
  echo "Copying mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}/bin/mongod"
  cp mongodb-linux-x86_64-ubuntu${UBUNTU_VERSION_WITHOUT_DOT}-${MONGO_VERSION}/bin/mongod ${SATDIR}/bin/
fi


# Moving installed programs to the ubuntu_post_build folder, copying configuration files and utilities. Compressing results
cd ${WORKDIR}
cd ../ubuntu_post_build
mkdir configs utilities
cp ../build-scripts/configs/ecosystem.config.js ./configs/
cp ../build-scripts/configs/default_settings.json ./configs/
cp ../build-scripts/utilities/configure.js ./utilities/
tar -czf biowardrobe-ng.tar.gz ./*
rm -rf satellite configs utilities