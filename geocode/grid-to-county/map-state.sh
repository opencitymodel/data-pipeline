#!/bin/bash

# These environment variables are expected to be set which determine what data we
# are working on and where to store the results when we are done.
if [ -z ${OCM_STATE+x} ]; then
    echo "OCM_STATE is not set"
    exit 1
elif [ -z ${OCM_GEOCODE_S3BUCKET+x} ]; then
    echo "OCM_GEOCODE_S3BUCKET is not set"
    exit 1
else
    echo "Preparing grid->county data for ${OCM_STATE} and saving output to s3://${OCM_GEOCODE_S3BUCKET}/"
fi

# download the state and county shapefiles
aws s3 cp s3://${OCM_GEOCODE_S3BUCKET}/county.geo.txt .

# process the state and build the grid -> county mapping file
# this will always produce a file named <state>-grid-to-counties.txt
node --max-old-space-size=8192 ./geocode-grids/app.js ./county.geo.txt ${OCM_STATE}

# push the resulting file up to S3
aws s3 cp ./${OCM_STATE}-grid-to-counties.txt s3://${OCM_GEOCODE_S3BUCKET}/
