#!/bin/bash

declare -a states=("Alabama" "Alaska" "Arizona" "Arkansas" "California" "Colorado" "Connecticut" "Delaware" "DistrictofColumbia" "Florida" "Georgia" "Hawaii" "Idaho" "Illinois" "Indiana" "Iowa" "Kansas" "Kentucky" "Louisiana" "Maine" "Maryland" "Massachusetts" "Michigan" "Minnesota" "Mississippi" "Missouri" "Montana" "Nebraska" "Nevada" "NewHampshire" "NewJersey" "NewMexico" "NewYork" "NorthCarolina" "NorthDakota" "Ohio" "Oklahoma" "Oregon" "Pennsylvania" "RhodeIsland" "SouthCarolina" "SouthDakota" "Tennessee" "Texas" "Utah" "Vermont" "Virginia" "Washington" "WestVirginia" "Wisconsin" "Wyoming")


# move through county numbers (2 at a time) until we hit max
for state in "${states[@]}"
do
   node ./geocode-grids/app.js ~/workspace/opencitymodel/data/geocode/state.geo.json ~/workspace/opencitymodel/data/geocode/county.geo.txt ${state}
done
