#!/bin/bash

MSFP_STATE="California"
SOURCE_DIRECTORY=$1
TARGET_DIRECTORY=$2


# all of the distinct areas with separate California data
declare -a areas=("Bakersfield" "Bay_Area" "Del Mar" "Fresno" "Fullerton" "Gilroy, Morgan Hill, Hollister" "Hollywood" "Modesto" "Oxnard" "Sacramento" "Santa Barbara" "Sonora" "Stockton")


mkdir -p ${TARGET_DIRECTORY}
cd ${TARGET_DIRECTORY}

## now loop through the above array
for area in "${areas[@]}"
do
    echo "$area"

    # Unzip
    unzip "${SOURCE_DIRECTORY}/California-${area}.zip"

    # Convert shapefile into GeoJSON
    SHAPE_RESTORE_SHX=YES ogr2ogr -f "GeoJSON" CaliArea.geo.json "${area}.shp"

    # Delete working files to save disk space
    rm -f "${area}".*

    # Parse out extra JSON so we have just a single polygon per line
    grep '{ "type": "Feature", "properties": { "Height"' CaliArea.geo.json > Cali-all.txt

    rm -f CaliArea.geo.json

    # filter out the buildings with a null Height value, we are not going to use those for now
    grep 'Height": [0-9].' Cali-all.txt >> California.txt

    rm -f Cali-all.txt
done
