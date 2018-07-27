#!/bin/bash

MSFP_DOWNLOAD_SITE="https://usbuildingdata.blob.core.windows.net"
MSFP_STATE=$1
MSFP_VERSION=$2
TARGET_DIRECTORY=$3

cd ${TARGET_DIRECTORY}

# Download
curl -O ${MSFP_DOWNLOAD_SITE}/${MSFP_VERSION}/${MSFP_STATE}.zip

# Unzip
unzip ${MSFP_STATE}.zip

# Parse out extra JSON so we have just a single polygon per line
grep '{"type":"Feature","geometry":{"type":"Polygon"' ${MSFP_STATE}.geojson | awk '{$1=$1};1' | sed -n 's;\({.*}}\).*$;\1;p' > ${MSFP_STATE}.txt
