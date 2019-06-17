#!/bin/bash

SOURCE_FILE=$1


###  NOTE: this data only pertains to California

LARIAC_DIR="LARIAC4"

mkdir -p ${LARIAC_DIR}

# Unzip
unzip ${SOURCE_FILE} -d ${LARIAC_DIR}

# Convert gdb into GeoJSON
ogr2ogr -f "GeoJSON" LA_county.geo.json ${LARIAC_DIR}/LARIAC_Buildings_2014.gdb LARIAC4_BUILDINGS_2014

# Delete gdb stuff
rm -rf ${LARIAC_DIR}

# Parse out GeoJSON scaffolding so we have a single Feature per line
grep '{ "type": "Feature", "properties": { ' LA_county.geo.json > California-raw.txt

# Delete the geojson file to save disk space
rm -f LA_county.geo.json

# transform CRS to WGS84 and adjust units from ft -> m
node transform.js California-raw.txt California.txt 2229

# finish tidy up
rm -f California-raw.txt
