#!/bin/bash

OCM_BLDGSFILES="./data/buildings"
OCM_GMLFILES="./data/gml"


# These environment variables are expected to be set which determine what data we
# are working on and where to store the results when we are done.
# OCM_MSFP_VERSION="usbuildings-v1-1"
# OCM_MSFP_STATE="DistrictofColumbia"
# OCM_S3BUCKET="buildzero-ocm-test"
if [ -z ${OCM_COUNTY+x} ]; then
    echo "OCM_COUNTY is not set"
    exit 1
elif [ -z ${OCM_STATE+x} ]; then
    echo "OCM_STATE is not set"
    exit 1
elif [ -z ${OCM_VERSION+x} ]; then
    echo "OCM_VERSION is not set"
    exit 1
elif [ -z ${OCM_BLDGS_S3BUCKET+x} ]; then
    echo "OCM_BLDGS_S3BUCKET is not set"
    exit 1
elif [ -z ${OCM_GML_S3BUCKET+x} ]; then
    echo "OCM_GML_S3BUCKET is not set"
    exit 1
else
    echo "Creating CityGML files for $OCM_VERSION/$OCM_STATE/$OCM_COUNTY and saving output to s3://$OCM_GML_S3BUCKET/"
fi


# make sure we have our working directories in place
mkdir -p ${OCM_BLDGSFILES}
mkdir -p ${OCM_GMLFILES}

# download the buildings data from S3 which we will be transforming into citygml
aws s3 cp s3://${OCM_BLDGS_S3BUCKET}/${OCM_VERSION}/${OCM_STATE}/cty=${OCM_COUNTY} ${OCM_BLDGSFILES}/ --recursive

# run our citygml builder
OUTFILE_PREFIX="${OCM_STATE}-${OCM_COUNTY}"
java -server -jar citygml.jar ${OCM_BLDGSFILES} ${OCM_GMLFILES} ${OUTFILE_PREFIX}

# push the citygml files back to S3
if [ $? -eq 0 ]; then
    aws s3 cp ${OCM_GMLFILES} s3://${OCM_GML_S3BUCKET}/${OCM_VERSION}/${OCM_STATE}/ --recursive
else
    exit 1
fi