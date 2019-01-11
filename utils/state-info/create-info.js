fs = require('fs');
readline = require('readline');
DynamoDB = require("aws-sdk/clients/dynamodb");

stateCodes = require('./state-codes');


// This script populates a DynamoDB table with very basic information about US states & counties.
// It takes as input the county shapefile used in our geocoding and from there extracts all the
// names and ids of the various US states & counties to create an easy place for us to reference that info.

const TABLE_NAME = "StateInfo";


function loadCountyShapes(countyShapefile) {
    const stateInfo = {};

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(countyShapefile, { encoding: "utf-8"})
    });

    stream.on("line", function(line) {
        if (line.endsWith(",")) {
            line = line.substring(0, line.length - 1);
        }
        const countyDef = JSON.parse(line);

        // extract a couple things
        const stateCode = countyDef.properties.STATEFP;
        const stateName = stateCodes[stateCode].name;
        const msfpStateName = stateName.replace(/ /g, "");

        const stateDef = stateInfo[msfpStateName] || { id: stateCode, name: msfpStateName, counties: [] };
        if (stateDef.counties.length === 0) {
            stateInfo[msfpStateName] = stateDef;
        }

        stateDef.counties.push({ id: countyDef.properties.GEOID, name: countyDef.properties.NAME })
    });

    stream.on("close", () => {
        console.log("finished loading county shapes");

        const dynamoClient = new DynamoDB.DocumentClient({
            region: "us-east-1"
        });
        Object.keys(stateInfo).forEach(key => {
            dynamoClient.put({
                TableName: TABLE_NAME,
                Item: stateInfo[key]
            }, (err, data) => {
                if (err) console.log(err);
            });
        });
    });
}

// this kicks things off and runs through everything
loadCountyShapes(process.argv[2]);
