#!/bin/bash

SOURCE_FILE=$1
TARGET_DIRECTORY=$2


###  NOTE: this data only pertains to California


mkdir -p ${TARGET_DIRECTORY}
cd ${TARGET_DIRECTORY}

# Unzip
unzip ${SOURCE_FILE}

# Convert gdb into GeoJSON
ogr2ogr -f "GeoJSON" LA_county.geo.json LARIAC_Buildings_2014.gdb LARIAC4_BUILDINGS_2014

# Delete gdb stuff
rm -f LARIAC_Buildings_2014.gdb "LARIAC4 Buildings (2014)*"

# Parse out GeoJSON scaffolding so we have a single Feature per line
grep '{ "type": "Feature", "properties": { ' LA_county.geo.json > California.txt

# Delete the geojson file to save disk space
rm -f LA_county.geo.json

# NOTE: this source data is in EPSG:2229 so to use it there needs to be a CRS transform
