byline = require('byline');
fs = require('fs');
mkdirp = require('mkdirp');
mgrs = require('mgrs');
centroid = require('polygon-centroid');
_ = require('underscore');


// we must have a file for us to process
if (process.argv.length < 3) {
    console.log("error: no file specified for processing");
    console.log("usage: node app.js <file-to-process>");
    return;
}

// we must have an environment variable telling us where to save our gridded files
if (!process.env.OCM_GRIDFILES) {
    console.log("error: environment variable 'OCM_GRIDFILES' is not set.  this is required.");
    return;
}


const INPUT_FILE = process.argv[2];
const FP_GRID_FOLDER = process.env.OCM_GRIDFILES;

// extract the filename from the infile
// NOTE: this assumes unix style paths and filenames with no '.' characters in them
const FP_STATE = INPUT_FILE.split('/').pop().split('.')[0];

// this breaks a 1km MGRS identifier into 3 parts
const MGRS_REGEX = /([0-9A-Z]+)([A-Z]{2})([0-9]{4})/


function writeFootprint(mgrsGrid, building) {
    // break apart mgrs and create a path on the fs for <GZD>/<GZD><GSID>/<MGRS>.txt
    const match = MGRS_REGEX.exec(mgrsGrid);
    const gzd = match[1];
    const gsid = match[2];
    const outpath = FP_STATE+"/"+gzd+"/"+gsid;

    // make sure our folder path exists, otherwise we can't open up the actual files
    mkdirp(FP_GRID_FOLDER+"/"+outpath, function(err) {
        if(err) {
            console.log("error creating directory", FP_GRID_FOLDER+"/"+outpath, err);
        } else {
            // TODO: this could probably be more efficient
            fs.appendFile(FP_GRID_FOLDER+"/"+outpath+"/"+mgrsGrid+".txt", JSON.stringify(building)+"\n", function (err) {
                if (err) console.log("error writing to", mgrsGrid, err);
            });
        }
    });
}

// taken from https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
// should be good enough when coupled together with the MGRS grid
function quickHash(str) {
    var quickHashVal = 0;
    if (str.length == 0) {
        return quickHashVal;
    }
    for (var quickHashInc = 0; quickHashInc < str.length; quickHashInc++) {
        var char = str.charCodeAt(quickHashInc);
        quickHashVal = ((quickHashVal<<5)-quickHashVal)+char;
        quickHashVal = quickHashVal & quickHashVal; // Convert to 32bit integer
    }
    return quickHashVal;
}

// open up our input file and start reading line by line
const stream = byline(fs.createReadStream(INPUT_FILE, { encoding: "utf-8"}));

stream.on("data", function(line) {
    const footprint = JSON.parse(line);

    // hash the geometry coordinates into a unique signature for the building
    const hashStr = footprint.geometry.coordinates[0].reduce(function (acc, val) {
        return acc + val;
    }, "");
    const signature = quickHash(hashStr);

    // calculate centroid
    const center = centroid(footprint.geometry.coordinates[0].map(function (point) {
        return { x: point[0], y: point[1] }
    }));

    // TODO: calculate area

    // calculate MGRS grid @ 1km resolution
    const mgrsGrid = mgrs.forward([center.x, center.y], 2);

    // add the footprint to output file
    writeFootprint(mgrsGrid, {
        sig: signature,
        msfp_st: FP_STATE,
        mgrs: mgrsGrid,
        ctr: center,
        fp: footprint
    });
});
