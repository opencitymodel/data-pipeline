#!/bin/bash

OCM_RAWFILES="./data/raw"
OCM_GRIDFILES="./data/grid"
OCM_GEOCODEFILES="./data/geocode"


# These environment variables are expected to be set which determine what data we
# are working on and where to store the results when we are done.
if [ -z ${OCM_DATASOURCE+x} ]; then
    echo "OCM_DATASOURCE is not set"
    exit 1
elif [ -z ${OCM_STATE+x} ]; then
    echo "OCM_STATE is not set"
    exit 1
elif [ -z ${OCM_DATASOURCE_S3BUCKET+x} ]; then
    echo "OCM_DATASOURCE_S3BUCKET is not set"
    exit 1
elif [ -z ${OCM_GRID_S3BUCKET+x} ]; then
    echo "OCM_GRID_S3BUCKET is not set"
    exit 1
elif [ -z ${OCM_GEOCODE_S3BUCKET+x} ]; then
    echo "OCM_GEOCODE_S3BUCKET is not set"
    exit 1
else
    echo "Gridding OCM data for $OCM_DATASOURCE/$OCM_STATE and saving output to s3://$OCM_GRID_S3BUCKET/"
fi


# make sure we have our working directories in place
mkdir -p ${OCM_RAWFILES}
mkdir -p ${OCM_GRIDFILES}
mkdir -p ${OCM_GEOCODEFILES}

# download prepped files to work on
aws s3 cp "s3://${OCM_DATASOURCE_S3BUCKET}/" ${OCM_RAWFILES}/ --recursive --exclude "*" --include "${OCM_DATASOURCE}/${OCM_STATE}*"

# download the relevant geocoding files
aws s3 cp s3://${OCM_GEOCODE_S3BUCKET}/county.geo.txt ${OCM_GEOCODEFILES}/
aws s3 cp s3://${OCM_GEOCODE_S3BUCKET}/${OCM_STATE}-mgrs-to-counties.txt ${OCM_GEOCODEFILES}/

# calculate attributes and reorg the footprints into MGRS grids
./grid-state.sh ${OCM_RAWFILES}/${OCM_DATASOURCE} ${OCM_GRIDFILES} ${OCM_GEOCODEFILES} ${OCM_STATE}

# push the grid of files up to S3
aws s3 cp ${OCM_GRIDFILES} s3://${OCM_GRID_S3BUCKET}/${OCM_DATASOURCE}/ --recursive
