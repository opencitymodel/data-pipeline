#!/bin/bash

# These environment variables are expected to be set which determine what data we
# are working on and where to store the results when we are done.
if [ -z ${OCM_DATASOURCE+x} ]; then
    echo "OCM_DATASOURCE is not set"
    exit 1
elif [ -z ${STATE+x} ]; then
    echo "STATE is not set"
    exit 1
elif [ -z ${OCM_DATASOURCE_S3BUCKET+x} ]; then
    echo "OCM_DATASOURCE_S3BUCKET is not set"
    exit 1
else
    echo "Extracting OSM building footprints for $STATE and saving output to s3://$OCM_DATASOURCE_S3BUCKET/$OCM_DATASOURCE/"
fi

# TODO: map OCM state names -> Geofabrik state names

GEOFABRIK_DOWNLOAD_SITE="http://download.geofabrik.de/north-america/us"
GEOFABRIK_STATE_NAME="$(echo $STATE | tr '[A-Z]' '[a-z]')"
GEOFABRIK_STATE_FILE="${GEOFABRIK_STATE_NAME}-latest.osm.pbf"

OCM_STATE="$(echo $STATE | tr -d '-')"

# download data from Geofabrik (alabama-latest.osm.pbf)
curl -O ${GEOFABRIK_DOWNLOAD_SITE}/${GEOFABRIK_STATE_FILE}

# convert OSM data to GeoJSON and filter to just the buildings
python3.6 extract-osm-buildings.py ${GEOFABRIK_STATE_FILE} ${OCM_STATE}
RESULT=$?

# upload the result to S3
if [ $RESULT -eq 0 ]; then
    aws s3 cp ./${OCM_STATE}.txt s3://${OCM_DATASOURCE_S3BUCKET}/${OCM_DATASOURCE}/${OCM_STATE}.txt
else
    exit 1
fi
