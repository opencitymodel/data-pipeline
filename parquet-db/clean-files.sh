#!/bin/bash

# remove all of the `_*` files that Spark includes in its output
aws --profile opencity s3 rm s3://ocm-buildings-db/version=$1/ --recursive --exclude "*.parquet"