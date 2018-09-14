byline = require('byline');
fs = require('fs');
geolib = require('geolib');
mkdirp = require('mkdirp');
mgrs = require('mgrs');
OpenLocationCode = require('open-location-code').OpenLocationCode;
pointInPolygon = require('point-in-polygon');
readline = require('readline');
_ = require('underscore');

stateCodes = require('./state-codes')



// we must have a file for us to process
if (process.argv.length < 3) {
    console.log("error: no state specified for processing");
    console.log("usage: node app.js <state-name>");
    return;
}

// we must have an environment variable telling us where to load our input files from
if (!process.env.OCM_RAWFILES) {
    console.log("error: environment variable 'OCM_RAWFILES' is not set.  this is required.");
    return;
}

// we must have an environment variable telling us where to save our gridded files
if (!process.env.OCM_GRIDFILES) {
    console.log("error: environment variable 'OCM_GRIDFILES' is not set.  this is required.");
    return;
}


const STATE = process.argv[2];
const FP_RAW_FOLDER = process.env.OCM_RAWFILES;
const FP_GRID_FOLDER = process.env.OCM_GRIDFILES;

const COUNTY_SHAPES_FILE = FP_RAW_FOLDER+"/county.geo.txt";
const COUNTY_MGRS_MAPPING_FILE = FP_RAW_FOLDER+"/"+STATE+"-mgrs-to-counties.txt";
const BUILDING_FOOTPRINTS = FP_RAW_FOLDER+"/"+STATE+".txt";

// this breaks a 1km MGRS identifier into 3 parts
const MGRS_REGEX = /([0-9A-Z]+)([A-Z]{2})([0-9]{4})/


function writeFootprint(mgrsGrid, building) {
    // break apart mgrs and create a path on the fs for <GZD>/<GZD><GSID>/<MGRS>.txt
    const match = MGRS_REGEX.exec(mgrsGrid);
    const gzd = match[1];
    const gsid = match[2];
    const outpath = STATE+"/"+gzd+"/"+gsid;

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

// adapted from the encode() function here https://github.com/pnnl/buildingid/blob/master/buildingid/v3.py#L90
function ubid(center, northeast, southwest) {
    const openloc = new OpenLocationCode();

    // Encode the OLCs for the northeast and southwest corners of the minimal
    // bounding box for the building footprint.
    const northeast_openlocationcode = openloc.encode(northeast.latitude, northeast.longitude)
    const southwest_openlocationcode = openloc.encode(southwest.latitude, southwest.longitude)

    // Encode the OLC for the centroid of the building footprint.
    const centroid_openlocationcode = openloc.encode(center.lat, center.lon)

    // Decode the OLCs for the northeast and southwest corners of the minimal
    // bounding box for the building footprint.
    const northeast_openlocationcode_CodeArea = openloc.decode(northeast_openlocationcode)
    const southwest_openlocationcode_CodeArea = openloc.decode(southwest_openlocationcode)

    // Decode the OLC for the centroid of the building footprint.
    const centroid_openlocationcode_CodeArea = openloc.decode(centroid_openlocationcode)

    // Calculate the size of the OLC for the centroid of the building footprint
    // in decimal degree units.
    const height = centroid_openlocationcode_CodeArea.latitudeHi - centroid_openlocationcode_CodeArea.latitudeLo
    const width = centroid_openlocationcode_CodeArea.longitudeHi - centroid_openlocationcode_CodeArea.longitudeLo

    // Calculate the Chebyshev distances to the northern, eastern, southern and
    // western of the OLC bounding box for the building footprint.
    const delta_north = Math.round((northeast_openlocationcode_CodeArea.latitudeHi - centroid_openlocationcode_CodeArea.latitudeHi) / height)
    const delta_east = Math.round((northeast_openlocationcode_CodeArea.longitudeHi - centroid_openlocationcode_CodeArea.longitudeHi) / width)
    const delta_south = Math.round((centroid_openlocationcode_CodeArea.latitudeLo - southwest_openlocationcode_CodeArea.latitudeLo) / height)
    const delta_west = Math.round((centroid_openlocationcode_CodeArea.longitudeLo - southwest_openlocationcode_CodeArea.longitudeLo) / width)

    // Construct and return the UBID code.
    return centroid_openlocationcode+"-"+delta_north+"-"+delta_east+"-"+delta_south+"-"+delta_west;
}


function loadCountyShapes() {
    const countyShapes = {};

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(COUNTY_SHAPES_FILE, { encoding: "utf-8"})
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

        // we only care about the counties for the state we are processing
        if (msfpStateName === STATE) {
            countyShapes[countyDef.properties.GEOID] = countyDef.geometry.coordinates[0];
        }
    });

    stream.on("close", () => {
        console.log("finished loading county shapes");

        // next load the mgrs->county mapping
        loadMgrsToCountyMapping(countyShapes);
    });
}

function loadMgrsToCountyMapping(countyShapes) {
    const mgrsToCountyMapping = {};

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(COUNTY_MGRS_MAPPING_FILE, { encoding: "utf-8"})
    });

    stream.on("line", function(line) {
        const mapping = JSON.parse(line);
        mgrsToCountyMapping[mapping.mgrs] = mapping.counties;
    });

    stream.on("close", () => {
        console.log("finished loading mgrs->county mapping");

        // now its time to process the building footprints
        processFootprints(countyShapes, mgrsToCountyMapping);
    });
}

function processFootprints(countyShapes, mgrsToCountyMapping) {
    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(BUILDING_FOOTPRINTS, { encoding: "utf-8"})
    });

    const missingCounty = {};

    stream.on("line", function(line) {
        const footprint = JSON.parse(line);

        // hash the geometry coordinates into a unique signature for the building
        const hashStr = footprint.geometry.coordinates[0].reduce(function (acc, val) {
            return acc + val;
        }, "");
        const signature = quickHash(hashStr);

        // calculate centroid
        const ctr = geolib.getCenter(footprint.geometry.coordinates[0].map(p => {
            return { longitude: p[0], latitude: p[1] }
        }));
        // not sure why, but the centroid funtion is returning values as strings =(
        const center = { lat: parseFloat(ctr.latitude), lon: parseFloat(ctr.longitude) }

        // calculate bounding box
        const bbox = geolib.getBounds(footprint.geometry.coordinates[0].map(p => {
            return { longitude: p[0], latitude: p[1] }
        }));

        // TODO: calculate area

        // calculate MGRS grid @ 1km resolution
        const mgrsGrid = mgrs.forward([center.lon, center.lat], 2);

        // calculate UBID for the footprint
        const bbox_ne = { latitude: bbox.maxLat, longitude: bbox.maxLng }
        const bbox_sw = { latitude: bbox.minLat, longitude: bbox.minLng }
        const bid = ubid(center, bbox_ne, bbox_sw);

        // reverse geocode to determine county
        let countyId = null;
        const possibleCounties = mgrsToCountyMapping[mgrsGrid];
        if (possibleCounties && possibleCounties.length > 0) {
            // if there is only 1 county for this grid then we are done
            if (possibleCounties.length === 1) {
                countyId = possibleCounties[0];

            // otherwise, we need to use the county shape files to determine the county for this building
            } else {
                countyId = _.find(possibleCounties, county => {
                    return pointInPolygon([center.lon, center.lat], countyShapes[county])
                });
            }
        } else {
            // TODO: if possibleCounties is non-existant then assume our prep job missed this grid and we need
            //      to do the work right now
            countyId = _.find(Object.keys(countyShapes), county => {
                return pointInPolygon([center.lon, center.lat], countyShapes[county])
            });

            if (countyId) {
                console.log("MISSING_MATCHED", mgrsGrid, countyId, center.lat+","+center.lon);
            } else {
                console.log("NO_COUNTY", mgrsGrid, center.lat+","+center.lon);
            }

            if (!missingCounty[mgrsGrid]) {
                missingCounty[mgrsGrid] = [];
            }

            missingCounty[mgrsGrid].push(center);
        }

        // add the footprint to output file
        writeFootprint(mgrsGrid, {
            sig: signature,
            ubid: bid,
            state: STATE,
            county: countyId,
            lat: center.lat,
            lon: center.lon,
            mgrs: mgrsGrid,
            fp: footprint
        });
    });

    stream.on("close", () => {
        const g = Object.keys(missingCounty).sort();
        g.forEach(grid => {
            console.log(grid, missingCounty[grid].length);
        });
        console.log(g.length);
    });
}

// this kicks things off and runs through everything
loadCountyShapes();
