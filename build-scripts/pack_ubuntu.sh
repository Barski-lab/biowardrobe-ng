#!/usr/bin/env bash

UBUNTU_VERSION=${1:-"18.04"}
NODE_VERSION=${2:-"12.21.0"}
MONGO_VERSION=${3:-"4.2.10"}


WORKING_DIR=$( cd "../$( dirname "${BASH_SOURCE[0]}" )" && pwd )
echo "Pack BioWardrobe-NG from ${WORKING_DIR} in dockerized Ubuntu $UBUNTU_VERSION"
docker run --rm -it \
    --volume ${WORKING_DIR}:/tmp/ubuntu \
    --workdir /tmp/ubuntu/build-scripts \
    --env NODE_VERSION=${NODE_VERSION} \
    --env MONGO_VERSION=${MONGO_VERSION} \
    ubuntu:${UBUNTU_VERSION} \
    /tmp/ubuntu/build-scripts/_ubuntu.sh
