#!/bin/bash

# Simple script which wraps the AWS cmd line tool and is meant for submitting
# a job to process the mgrs-to-county file for a given state
NAME="mgrs-to-county"
REVISION="2"
QUEUE="SmallBatchJobs"

STATE=$1
DATE=`date +%s`
JOB_NAME="${STATE}-${NAME}-${DATE}"
JOB_DEF="${NAME}:${REVISION}"
JOB_PROPS="{\"environment\":[{\"name\":\"OCM_STATE\",\"value\":\"${STATE}\"}]}"

# TODO: we could potentially try to lookup the latest revision for the job def, or ask the user for it?

aws batch submit-job --job-name $JOB_NAME --job-definition $JOB_DEF --job-queue $JOB_QUEUE --container-overrides $JOB_PROPS
