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
        loadStates(counties);
    });
}

function loadStates(counties) {
    // pull out just the state we are working on
    const countiesByState = _.groupBy(counties, 'msfp');
    counties = countiesByState[STATE];

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
function processState(stateDef, countyDefs) {
    const started = new Date();
    console.log("Starting "+STATE+" @", started);

    // get a list of all shapes which make up the state
    const bboxes = getBoxes(stateDef);

    const grids = {};

    // iterate over each shape and compute its mgrs grids
    bboxes.forEach(bbox => {
        console.log("bbox", "("+bbox.minLng+","+bbox.minLat+","+bbox.maxLng+","+bbox.maxLat+")");

        // determine all of the possible MGRS grids within our bounding box
        const possibleGrids = findGrids(bbox);
        const findGridsTime = (new Date().getTime()-started.getTime())/60000;
        console.log(`  found=${possibleGrids.size} in ${findGridsTime}m`);

        // iterate over the possible grids and test them, first for within state then for which county(s)
        let tested = 0;
        let added = 0;
        possibleGrids.forEach(grid => {
            if (!grids[grid]) {
                tested++;

                const gridDef = {};

                // NOTE: regardless of whether this grid is within the state shape we want to add it to our grids so that
                //       we don't attempt to process this same grid again during our iteration
                grids[grid] = gridDef;

                // if this grid is within our designated state then try to map which counties it overlaps
                if (isGridInShape(grid, stateDef)) {
                    added++;

                    gridDef.mgrs = grid;
                    gridDef.counties = [];

                    // iterate over our counties and determine which ones overlap this grid
                    for(let idx = 0; idx < countyDefs.length; idx++) {
                        const county = countyDefs[idx];
                        if (isGridInShape(grid, county)) {
                            gridDef.counties.push(county.properties.GEOID);
                        }
                    }

                    if (gridDef.counties.length === 0) {
                        // presumably this should never happen where a grid doesn't seem to lie within any county
                        console.log("NO_COUNTIES", grid, nwLat+","+nwLon)
                    }
                }
            }
        });

        console.log(`  tested=${tested}, added=${added}`)
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
    console.log("Finished "+STATE+" @", finished, "("+(finished.getTime()-started.getTime())/60000+")");
}


// find all of the 1km MGRS grids within a given bounding box
const MOVEMENT = 0.0001;  // this equates to moving roughly 36ft
function findGrids(bbox) {
    const grids = new Set();

    // these are the termination points of the bbox, which we pad a little
    const bboxMinLon = bbox.maxLng + 0.2;
    const bboxMinLat = bbox.minLat - 0.2;

    let lat = bbox.maxLat + 0.2;
    let lon = bbox.minLng - 0.2;
    while (lat > bboxMinLat) {
        while (lon < bboxMinLon) {
            const grid = mgrs.forward([lon, lat], 2);

            grids.add(grid);

            // move east
            lon = lon + MOVEMENT;
        }

        // reset lon and move lat south
        lon = bbox.minLng - 0.2;
        lat = lat - MOVEMENT;
    }

    return grids;
}


// enumerate the bounding boxes for each shape making up a state
function getBoxes(stateDef) {
    // NOTE: we are only considering the outer line ring since that's all we need
    if (stateDef.geometry.type === "Polygon") {
        return [geolib.getBounds(stateDef.geometry.coordinates[0].map(p => {
            return { longitude: p[0], latitude: p[1] }
        }))];

    } else if (stateDef.geometry.type === "MultiPolygon") {
        return stateDef.geometry.coordinates.map(polygon => {
            return geolib.getBounds(polygon[0].map(p => {
                return { longitude: p[0], latitude: p[1] }
            }));
        });
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
