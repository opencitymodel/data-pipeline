#!/bin/bash

# These environment variables are expected to be set which determine what data we
# are working on and where to store the results when we are done.
# YEAR=2017
# OCM_GEOCODE_S3BUCKET="ocm-geocode"
if [ -z ${YEAR+x} ]; then
    echo "YEAR is not set"
    exit 1
elif [ -z ${OCM_GEOCODE_S3BUCKET+x} ]; then
    echo "OCM_GEOCODE_S3BUCKET is not set"
    exit 1
else
    echo "Preparing MGRS->county data for ${OCM_STATE} and saving output to s3://${OCM_GEOCODE_S3BUCKET}/"
fi


# download the state and county shapefiles
curl -O https://www2.census.gov/geo/tiger/TIGER2017/STATE/tl_${YEAR}_us_state.zip
curl -O https://www2.census.gov/geo/tiger/TIGER2017/COUNTY/tl_${YEAR}_us_county.zip

# unzip the files
unzip tl_${YEAR}_us_state.zip
unzip tl_${YEAR}_us_county.zip

# convert ESRI shapefiles to GeoJSON
ogr2ogr -f "GeoJSON" state.geo.json tl_${YEAR}_us_state.shp tl_${YEAR}_us_state
ogr2ogr -f "GeoJSON" county.geo.json tl_${YEAR}_us_county.shp tl_${YEAR}_us_county

# county shapefile is a bit massive, so split the individual shapes into JSON per line format
grep '{ "type": "Feature", "properties": { "STATEFP"' county.geo.json | awk '{$1=$1};1' > county.geo.txt

# push the resulting files up to S3
aws s3 cp ./state.geo.json s3://${OCM_GEOCODE_S3BUCKET}/
aws s3 cp ./county.geo.txt s3://${OCM_GEOCODE_S3BUCKET}/
