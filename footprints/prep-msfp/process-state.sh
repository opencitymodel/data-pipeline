#!/bin/bash

OCM_RAWFILES="./data/msfp"
OCM_GRIDFILES="./data/grid"


# These environment variables are expected to be set which determine what data we
# are working on and where to store the results when we are done.
# OCM_MSFP_VERSION="usbuildings-v1-1"
# OCM_MSFP_STATE="DistrictofColumbia"
# OCM_S3BUCKET="buildzero-ocm-test"
if [ -z ${OCM_MSFP_VERSION+x} ]; then
    echo "OCM_MSFP_VERSION is not set"
    exit 1
elif [ -z ${OCM_MSFP_STATE+x} ]; then
    echo "OCM_MSFP_STATE is not set"
    exit 1
elif [ -z ${OCM_S3BUCKET+x} ]; then
    echo "OCM_S3BUCKET is not set"
    exit 1
else
    echo "Preparing OCM data for $OCM_MSFP_VERSION/$OCM_MSFP_STATE and saving output to s3://$OCM_S3BUCKET/"
fi


# make sure we have our working directories in place
mkdir -p ${OCM_RAWFILES}
mkdir -p ${OCM_GRIDFILES}

# download and prep the raw files for the state
./download-and-prep.sh ${OCM_MSFP_STATE} ${OCM_MSFP_VERSION} ${OCM_RAWFILES}

# reorg the shapefiles into MGRS grids and attach some useful attributes
# --max-old-space-size=8192
OCM_GRIDFILES=${OCM_GRIDFILES} node ./grid-and-attrs/app.js ./${OCM_RAWFILES}/${OCM_MSFP_STATE}.txt

# push the grid of files up to S3
aws s3 cp ${OCM_GRIDFILES} s3://${OCM_S3BUCKET}/${OCM_MSFP_VERSION}/ --recursive
