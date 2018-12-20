#!/bin/bash

VERSION=$1
STATE=$2
STATECODE=$3
MAXCOUNTY=$4

# move through county numbers (2 at a time) until we hit max
for cnt in {1..300}
do
   if [[ $((cnt%2)) -eq 1 ]] && [[ $cnt -le ${MAXCOUNTY} ]];
   then
      printf -v county "${STATECODE}%03d" $cnt
      ./submit-citygml-job.sh $VERSION $STATE $county
   fi
done
