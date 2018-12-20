#!/bin/bash

# Simple script which wraps the AWS cmd line tool and is meant for submitting
# a job to generate citygml for a given state & county
NAME="citygml"
REVISION="4"
QUEUE="SmallBatchJobs"

VERSION=$1
STATE=$2
COUNTY=$3
DATE=`date +%s`
JOB_NAME="${STATE}-${NAME}-${DATE}"
JOB_DEF="${NAME}:${REVISION}"
JOB_PROPS="{\"environment\":[{\"name\":\"OCM_STATE\",\"value\":\"${STATE}\"},{\"name\":\"OCM_COUNTY\",\"value\":\"${COUNTY}\"},{\"name\":\"OCM_VERSION\",\"value\":\"${VERSION}\"}]}"


# TODO: we could potentially try to lookup the latest revision for the job def, or ask the user for it?

aws batch submit-job --job-name $JOB_NAME --job-definition $JOB_DEF --job-queue $QUEUE --container-overrides $JOB_PROPS
