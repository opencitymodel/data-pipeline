#!/bin/bash

# Simple script which wraps the AWS cmd line tool and is meant for submitting
# a job to prep the msfp data for a given state
NAME="prep-msfp"
REVISION="3"
QUEUE="SmallBatchJobs"

STATE=$1
MSFP_VERSION=$2
DATE=`date +%s`
JOB_NAME="${STATE}-${NAME}-${DATE}"
JOB_DEF="${NAME}:${REVISION}"
JOB_PROPS="{\"environment\":[{\"name\":\"OCM_MSFP_STATE\",\"value\":\"${STATE}\"},{\"name\":\"OCM_MSFP_VERSION\",\"value\":\"${MSFP_VERSION}\"}]}"


# TODO: we could potentially try to lookup the latest revision for the job def, or ask the user for it?

aws batch submit-job --job-name $JOB_NAME --job-definition $JOB_DEF --job-queue $QUEUE --container-overrides $JOB_PROPS
