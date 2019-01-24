byline = require('byline');
fs = require('fs');
geolib = require('geolib');
mkdirp = require('mkdirp');
mgrs = require('mgrs');
OpenLocationCode = require('open-location-code').OpenLocationCode;
pointInPolygon = require('point-in-polygon');
readline = require('readline');
turf_area = require('@turf/area')
turf_helpers = require('@turf/helpers')
_ = require('underscore');
yargs = require('yargs');

stateCodes = require('./state-codes');


// This script takes in a file of GeoJSON features (1 per line) and calculates a
// series of custom attributes for the object then writes out a new JSON object.


// this will parse our command line options
const appArgs = yargs
    .example("node $0 -s California -i ./California.txt -o ./data/grid -c ./California.geo.json -m California-mgrs-to-county.json")
    .option("input-file", {
        alias: "i",
        demandOption: true,
        describe: "file of GeoJSON to process",
        requiresArg: true,
        type: "string"
    })
    .option("state", {
        alias: "s",
        demandOption: true,
        describe: "US state being processed",
        requiresArg: true,
        type: "string"
    })
    .option("output-folder", {
        alias: "o",
        demandOption: true,
        describe: "where the output files are written",
        requiresArg: true,
        type: "string"
    })
    .option("county-shapes", {
        alias: "c",
        demandOption: true,
        describe: "GeoJSON file of US county shapes",
        requiresArg: true,
        type: "string"
    })
    .option("mgrs-to-county-file", {
        alias: "m",
        demandOption: true,
        describe: "mgrs-to-county mapping file",
        requiresArg: true,
        type: "string"
    })
    .help()
    .argv


// this breaks a 1km MGRS identifier into 3 parts
const MGRS_REGEX = /([0-9A-Z]+)([A-Z]{2})([0-9]{4})/


function writeFootprint(state, mgrsGrid, outdir, building) {
    // break apart mgrs and create a path on the fs for <GZD>/<GZD><GSID>/<MGRS>.txt
    const match = MGRS_REGEX.exec(mgrsGrid);
    const gzd = match[1];
    const gsid = match[2];

    // make sure our folder path exists, otherwise we can't open up the actual files
    mkdirp(outdir+"/"+state, function(err) {
        if(err) {
            console.log("error creating directory", outdir+"/"+outpath, err);
        } else {
            // TODO: this could probably be more efficient
            fs.appendFile(`${outdir}/${state}/${gzd}${gsid}.txt`, JSON.stringify(building)+"\n", function (err) {
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


// test if a given point falls within the shape of a county
// NOTE: we only test if the point is inside the outer linear-ring of each polygon, so we don't account for holes in polygons
function pointInCounty(point, countyDef) {
    if( countyDef.geometry.type === "Polygon" && countyDef.geometry.coordinates.length > 0 ) {
        return pointInPolygon(point, countyDef.geometry.coordinates[0]);

    } else if (countyDef.geometry.type === "MultiPolygon") {
        // shapes with multiple polygons, so we need to test them all
        // NOTE: in geojson a MultiPolygon has each member of its coordinates structured like a Polygon
        for( let k=0; k < countyDef.geometry.coordinates.length; k++ ) {
            const polygon = countyDef.geometry.coordinates[k];
            if (pointInPolygon(point, polygon[0])) return true;
        }
    }

    return false;
}


function loadCountyShapes(args) {
    const countyShapes = {};

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(args.countyShapes, { encoding: "utf-8"})
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
        if (msfpStateName === args.state) {
            countyShapes[countyDef.properties.GEOID] = countyDef;
        }
    });

    stream.on("close", () => {
        console.log("finished loading county shapes");

        // next load the mgrs->county mapping
        loadMgrsToCountyMapping(args, countyShapes);
    });
}

function loadMgrsToCountyMapping(args, countyShapes) {
    const mgrsToCountyMapping = {};

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(args.mgrsToCountyFile, { encoding: "utf-8"})
    });

    stream.on("line", function(line) {
        const mapping = JSON.parse(line);
        mgrsToCountyMapping[mapping.mgrs] = mapping.counties;
    });

    stream.on("close", () => {
        console.log("finished loading mgrs->county mapping");

        // now its time to process the building footprints
        processFootprints(args, countyShapes, mgrsToCountyMapping);
    });
}

function processFootprints(args, countyShapes, mgrsToCountyMapping) {
    const started = new Date();
    console.log("Starting "+args.state+" @", started);

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(args.inputFile, { encoding: "utf-8"})
    });

    let fpErrors = 0;
    stream.on("line", function(line) {
        try {
            if (line.endsWith(",")) {
                line = line.substring(0, line.length - 1);
            }

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

            // calculate area
            const turfPoly = turf_helpers.polygon(footprint.geometry.coordinates);
            const area = turf_area.default(turfPoly);

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
                        return pointInCounty([center.lon, center.lat], countyShapes[county])
                    });
                }
            } else {
                // TODO: if possibleCounties is non-existant then assume our prep job missed this grid and we need
                //      to do the work right now
                countyId = _.find(Object.keys(countyShapes), county => {
                    return pointInCounty([center.lon, center.lat], countyShapes[county])
                });

                if (countyId) {
                    console.log("MISSING_MATCHED", mgrsGrid, countyId, center.lat+","+center.lon);
                } else {
                    console.log("NO_COUNTY", mgrsGrid, center.lat+","+center.lon);
                }
            }

            // look for existing height property on footprint
            // TODO: this is pretty specific.  we should consider a more generic way to do this
            const height = footprint.properties.Height;

            // add the footprint to output file
            writeFootprint(args.state, mgrsGrid, args.outputFolder, {
                sig: signature,
                ubid: bid,
                state: args.state,
                county: countyId,
                lat: center.lat,
                lon: center.lon,
                mgrs: mgrsGrid,
                area,
                height,
                fp: footprint
            });
        } catch(error) {
            console.log("error processing footprint", error, line);
            fpErrors++;
        }
    });

    stream.on("close", () => {
        if (fpErrors > 0) {
            console.log("Finished with", fpErrors, "errors");
        }

        const finished = new Date();
        console.log("Finished "+args.state+" @", finished, "("+Math.round((finished.getTime()-started.getTime())/60000)+"m)");
    });
}

// this kicks things off and runs through everything
loadCountyShapes(appArgs);
