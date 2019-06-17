#!/bin/bash

SOURCE_DIRECTORY=$1
TARGET_DIRECTORY=$2
MSFP_STATE=$3

if [[ "$MSFP_STATE" == *"California"* ]]; then
    echo "use convert-and-prep-California.sh instead"
    exit 1
fi


mkdir -p ${TARGET_DIRECTORY}
cd ${TARGET_DIRECTORY}

# Unzip
unzip ${SOURCE_DIRECTORY}/${MSFP_STATE}.zip

# Delete the original zip to save disk space
rm -f ${MSFP_STATE}.zip

# Convert shapefile into GeoJSON
ogr2ogr -f "GeoJSON" ${MSFP_STATE}.geo.json bldg_footprints.shp bldg_footprints

# Delete shapefile stuff
rm -f bldg_footprints.*

# Parse out extra JSON so we have just a single polygon per line
grep '{ "type": "Feature", "properties": { "Height"' ${MSFP_STATE}.geo.json > ${MSFP_STATE}-all.txt

# Delete the geojson file to save disk space
rm -f ${MSFP_STATE}.geo.json

# filter out the buildings with a null Height value, we are not going to use those for now
grep 'Height": [0-9].' ${MSFP_STATE}-all.txt > ${MSFP_STATE}.txt

#rm -f ${MSFP_STATE}-all.txt