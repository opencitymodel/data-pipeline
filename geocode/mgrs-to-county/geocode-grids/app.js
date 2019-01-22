fs = require('fs');
geolib = require('geolib');
mgrs = require('mgrs');
pointInGeopolygon = require('point-in-geopolygon');
pointInPolygon = require('point-in-polygon');
proj4 = require('proj4');
readline = require('readline');
turf = require('@turf/turf');
turfIntersect = require('@turf/intersect').default;
_ = require('underscore');

stateCodes = require('./state-codes')


// we must have a file for us to process
if (process.argv.length < 3) {
    console.log("error: no county shapefile specified");
    console.log("usage: node app.js <state-shapefile> <county-shapefile> <msfp-state>");
    return;
}

// we must have a file for us to process
if (process.argv.length < 4) {
    console.log("error: no state shapefile specified");
    console.log("usage: node app.js <state-shapefile> <county-shapefile> <msfp-state>");
    return;
}

// we must have a file for us to process
if (process.argv.length < 5) {
    console.log("error: no state specified to process");
    console.log("usage: node app.js <state-shapefile> <county-shapefile> <msfp-state>");
    return;
}


const STATE_SHAPES_FILE = process.argv[2];
const COUNTY_SHAPES_FILE = process.argv[3];
const STATE = process.argv[4];

const OUTPUT_FILE = "./"+STATE+"-mgrs-to-counties.txt";


function loadCounties() {
    const counties = [];

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
        const countyCode = countyDef.properties.COUNTYFP;
        const stateCode = countyDef.properties.STATEFP;
        const stateName = stateCodes[stateCode].name;
        const msfpStateName = stateName.replace(/ /g, "");

        countyDef.msfp = msfpStateName;
        counties.push(countyDef);
    });

    stream.on("close", () => {
        console.log("finished loading counties shapefile", counties.length);

        // pull out just the state we are working on
        const countiesByState = _.groupBy(counties, 'msfp');

        // here we go
        processState(countiesByState[STATE]);
    });
}

function loadStates(counties) {


    fs.readFile(STATE_SHAPES_FILE, "utf8", function(err, data) {
        // read in state shapes
        const stateDefs = JSON.parse(data);
        console.log("finished loading states shapefile", stateDefs.features.length);

        stateDefs.features.forEach(stateDef => {
            const msfpStateName = stateDef.properties.NAME.replace(/ /g, "");
            stateDef.msfp = msfpStateName;

            if (msfpStateName === STATE) {
                processState(stateDef, counties);
            }
        })
    });
}

// build a mapping of MGRS grid -> [county, county, ...] for a given state
function processState(countyDefs) {
    const started = new Date();
    console.log("Starting "+STATE+" @", started);

    const grids = {};

    // iterate over each county in the state
    countyDefs.forEach(countyDef => {
        const countyStart = new Date();
        console.log(`County = ${countyDef.properties.NAME}`);

        // some counties have multiple polygons, so go through them 1-by-1
        const countyPolygons = getCountyPolygons(countyDef);
        countyPolygons.forEach(countyPolygon => {
            const polygonStart = new Date();

            // determine the bounding box of our polygon
            const bbox = geolib.getBounds(countyPolygon.map(p => {
                return { longitude: p[0], latitude: p[1] }
            }));
            console.log("  bbox", "("+bbox.minLng+","+bbox.minLat+","+bbox.maxLng+","+bbox.maxLat+")");

            // determine all of the possible MGRS grids within our bounding box
            const possibleGrids = findGrids(bbox);
            const findGridsTime = Math.round((new Date().getTime()-polygonStart.getTime())/1000);
            console.log(`    found=${possibleGrids.size}  (${findGridsTime}s)`);

            // we are testing a specific county polygon, so set that up
            const countyPolygonShape = {
                geometry: {
                    type: "Polygon",
                    coordinates: [countyPolygon]
                }
            };

            // iterate over the possible grids and test if they fall within the polygon
            let added = 0;
            possibleGrids.forEach(grid => {
                const gridDef = grids[grid] || { mgrs: grid, counties: [] };

                // test that the grid falls within the polygon
                if (isGridInShape(grid, countyPolygonShape)) {
                    added++;
                    gridDef.counties.push(countyDef.properties.GEOID);

                    // make sure we assign the updated grid
                    grids[grid] = gridDef;
                }
            });

            const bboxTime = Math.round((new Date().getTime()-polygonStart.getTime())/1000);
            console.log(`    added=${added}  (${bboxTime}s)`);
        });

        const countyTime = Math.round((new Date().getTime()-countyStart.getTime())/60000);
        console.log(`  ${countyDef.properties.NAME} completed in ${countyTime}m`);
    });

    // write valid grids out into a file
    const outstream = fs.createWriteStream(OUTPUT_FILE);
    Object.keys(grids).forEach(grid => {
        const gridDef = grids[grid];

        if (gridDef.mgrs) {
            outstream.write(JSON.stringify(gridDef)+"\n", "utf8");
        }
    });
    outstream.end();

    const finished = new Date();
    const stateFinished = Math.round((finished.getTime()-started.getTime())/60000);
    console.log("Finished "+STATE+" @", finished, "("+stateFinished+"m)");
}


// find all of the 1km MGRS grids within a given bounding box
const MOVEMENT = 0.0001;  // this equates to moving roughly 36ft
function findGrids(bbox) {
    const grids = new Set();

    // these are the termination points of the bbox, which we pad a little
    const bboxMinLon = bbox.maxLng + 0.05;
    const bboxMinLat = bbox.minLat - 0.05;

    let lat = bbox.maxLat + 0.05;
    let lon = bbox.minLng - 0.05;
    while (lat > bboxMinLat) {
        while (lon < bboxMinLon) {
            const grid = mgrs.forward([lon, lat], 2);

            grids.add(grid);

            // move east
            lon = lon + MOVEMENT;
        }

        // reset lon and move lat south
        lon = bbox.minLng - 0.05;
        lat = lat - MOVEMENT;
    }

    return grids;
}


// enumerate the bounding boxes for each shape
function getCountyPolygons(countyDef) {
    // NOTE: we are only considering the outer line-ring of each polygon since that's all we need
    if (countyDef.geometry.type === "Polygon") {
        return [countyDef.geometry.coordinates[0]];

    } else if (countyDef.geometry.type === "MultiPolygon") {
        return countyDef.geometry.coordinates.map(polygon => polygon[0]);
    }
}


// Test if a given MGRS grid lies within (any part) of a given county shape
function isGridInShape(grid, shape) {

    try {
        const pt = mgrs.inverse(grid);

        const maxLon = pt[0];
        const minLat = pt[1];
        const minLon = pt[2];
        const maxLat = pt[3];

        // NOTE: first and last vertex must be equivalent to be a closed polygon and we need to start on the left most vertex
        const mgrsPolygon = turf.polygon([[[minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat], [minLon, maxLat]]]);

        if ( shape.geometry.type === "Polygon") {
            const countyPolygon = turf.polygon(shape.geometry.coordinates);
            if (turfIntersect(mgrsPolygon, countyPolygon)) return true;

        } else if ( shape.geometry.type === "MultiPolygon" ) {
            // test each polygon
            for( let i=0; i < shape.geometry.coordinates.length; i++ ) {
                const countyPolygon = turf.polygon(shape.geometry.coordinates[i]);
                if (turfIntersect(mgrsPolygon, countyPolygon)) return true;
            }
        }

        return false;

    } catch (err) {
        console.log("error testing grid", grid, err);
        return false;
    }
}


// this kicks us off
loadCounties();
