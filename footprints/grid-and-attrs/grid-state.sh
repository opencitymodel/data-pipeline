#!/bin/bash

SOURCE_DIR=$1
DESTINATION_DIR=$2
GEOCODE_DIR=$3
STATE=$4

# reorg the shapefiles into grids and attach some useful attributes
# --max-old-space-size=8192
node app.js -s ${STATE} -i ${SOURCE_DIR}/${STATE}.txt -o ${DESTINATION_DIR} -c ${GEOCODE_DIR}/county.geo.txt -m ${GEOCODE_DIR}/${STATE}-grid-to-counties.txt
