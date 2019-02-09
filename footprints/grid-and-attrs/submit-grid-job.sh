#!/bin/bash

# Simple script which wraps the AWS cmd line tool and is meant for submitting a job to aws batch
NAME="grid-and-attrs"
REVISION="2"
QUEUE="GridAndAttrsJobs"

DATASOURCE=$1
STATE=$2
DATE=`date +%s`
JOB_NAME="${DATASOURCE}-${STATE}-${NAME}-${DATE}"
JOB_DEF="${NAME}:${REVISION}"
JOB_PROPS="{\"environment\":[{\"name\":\"OCM_STATE\",\"value\":\"${STATE}\"},{\"name\":\"OCM_DATASOURCE\",\"value\":\"${DATASOURCE}\"}]}"


# TODO: we could potentially try to lookup the latest revision for the job def, or ask the user for it?

aws batch submit-job --job-name $JOB_NAME --job-definition $JOB_DEF --job-queue $QUEUE --container-overrides $JOB_PROPS
