AWS = require('aws-sdk');
DynamoDB = require("aws-sdk/clients/dynamodb");


const NAME="citygml"
const REVISION="8"
const QUEUE="CitygmlJobs"
const JOB_DEF=`${NAME}:${REVISION}`

const ALL_FORMATS = ["gml", "json"];
const ALL_STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "DistrictofColumbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "NewHampshire", "NewJersey", "NewMexico", "NewYork", "NorthCarolina", "NorthDakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "RhodeIsland", "SouthCarolina", "SouthDakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "WestVirginia", "Wisconsin", "Wyoming"];


const batch = new AWS.Batch({
    region: "us-east-1"
});
const dynamoClient = new DynamoDB.DocumentClient({
    region: "us-east-1"
});


async function sleep(n) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), n*1000);
    });
}

function createJobDef(version, format, state, county) {
    const date=new Date().getTime();
    const jobName = `${version}-${format}-${state}-${county}-${date}`;
    return {
        jobName,
        jobDefinition: JOB_DEF,
        jobQueue: QUEUE,
        containerOverrides: {
            environment: [
                { name: "OCM_VERSION", value: version },
                { name: "OCM_FORMAT", value: format },
                { name: "OCM_STATE", value: state },
                { name: "OCM_COUNTY", value: county }
            ]
        }
    }
}

function submitJob(jobDef) {
    return new Promise((resolve, reject) => {
        batch.submitJob(jobDef, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function submitStateJobs(version, format, state, countyId) {
    return new Promise(async (resolve, reject) => {
        if (countyId === "all") {
            console.log("attempting to submit all counties for", state);

            // find all counties for the given state
            dynamoClient.get({
                TableName: "StateInfo",
                Key: {
                    name: state
                }
            }, async (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    // iterate over counties and submit a job for each of them
                    const stateDef = data.Item;
                    if( stateDef ) {
                        for( let i=0; i < stateDef.counties.length; i++ ) {
                            try {
                                // when we are submitting lots of jobs at a time its best to add some wait times
                                const result = await submitJob(createJobDef(version, format, state, stateDef.counties[i].id));
                                console.log(result.jobName, result.jobId);
                            } catch(err) {
                                console.log("error submitting job", err);
                            }
                        }
                    } else {
                        reject("failed to get stateDef for "+state);
                    }

                    resolve(true);
                }
            });

        } else {
            // just a single county
            try {
                const result = await submitJob(createJobDef(version, format, state, countyId));
                console.log(result.jobName, result.jobId);
                resolve(true);
            } catch(err) {
                reject(err);
            }
        }
    });
}

async function submitAllJobs(version, formats, states, countyId) {
    // handle each permutation of FORMAT,STATE,COUNTY desired
    for ( let i=0; i < formats.length; i++ ) {
        const format = formats[i];
        for ( let j=0; j < states.length; j++ ) {
            const state = states[j];

            try {
                await submitStateJobs(version, format, state, countyId);
            } catch(err) {
                console.log("error with state job", err);
            }

            if (states.length > 1) try {
                // take a break before submitting next state
                await sleep(4);
            } catch(err) {
                console.log("error sleeping :/", err);
            }
        }
    }
}


const VERSION=process.argv[2];
const FORMAT=process.argv[3];
const STATE=process.argv[4];
const COUNTY=process.argv[5];

const FORMAT_LIST = FORMAT === "all" ? ALL_FORMATS : [FORMAT];
const STATE_LIST = STATE === "all" ? ALL_STATES : [STATE];

submitAllJobs(VERSION, FORMAT_LIST, STATE_LIST, COUNTY).then(result => {
    // no-op
}).catch(err => {
    console.log("unhandled error", err);
});
