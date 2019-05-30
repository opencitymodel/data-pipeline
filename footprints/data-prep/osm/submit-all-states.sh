#!/bin/bash

declare -a states=("Alabama" "Alaska" "Arizona" "Arkansas" "California" "Colorado" "Connecticut" "Delaware" "District-of-Columbia" "Florida" "Georgia" "Hawaii" "Idaho" "Illinois" "Indiana" "Iowa" "Kansas" "Kentucky" "Louisiana" "Maine" "Maryland" "Massachusetts" "Michigan" "Minnesota" "Mississippi" "Missouri" "Montana" "Nebraska" "Nevada" "New-Hampshire" "New-Jersey" "New-Mexico" "New-York" "North-Carolina" "North-Dakota" "Ohio" "Oklahoma" "Oregon" "Pennsylvania" "Rhode-Island" "South-Carolina" "South-Dakota" "Tennessee" "Texas" "Utah" "Vermont" "Virginia" "Washington" "West-Virginia" "Wisconsin" "Wyoming")


# move through county numbers (2 at a time) until we hit max
for state in "${states[@]}"
do
   ./submit-export-job.sh $1 $state
done