fs = require('fs');
geolib = require('geolib');
mgrs = require('mgrs');
pointInGeopolygon = require('point-in-geopolygon');
pointInPolygon = require('point-in-polygon');
proj4 = require('proj4');
readline = require('readline');
turf = require('@turf/turf')
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
            // console.log(stateDef.msfp, stateDef.geometry.type, stateDef.geometry.coordinates.length);

            if (msfpStateName === STATE) {
                // counties.forEach(countyDef => {
                //     console.log("county - "+countyDef.properties.NAME, countyDef.geometry.type, countyDef.geometry.coordinates.length)
                // })
                processState(stateDef, counties);
            }
        })
    });
}

// build a mapping of MGRS grid -> [county, county, ...] for a given state
function processState(stateDef, counties) {
    const started = new Date();
    console.log("Starting "+STATE+" @", started);

    // make a bbox of the state
    const bbox = geolib.getBounds(stateDef.geometry.coordinates[0].map(p => {
        return { longitude: p[0], latitude: p[1] }
    }));
    console.log("bbox", "("+bbox.minLng+","+bbox.minLat+","+bbox.maxLng+","+bbox.maxLat+")");

    // move grid by grid across the bounding box to build our dataset
    // NOTE: we add 0.04 to our NW corner calculations as a kind of buffer against error as somehow if we start
    //       with the actual NW point of our bounding box we still seem to be able to miss some of the grids
    //       along the northern edge the state in some cases, so this is a simple workaround.
    const nwLat = bbox.maxLat + 0.04;
    const nwLon = bbox.minLng - 0.04;
    const nwGrid = mgrs.forward([nwLon, nwLat], 2);
    const grids = addGrid({}, nwGrid, stateDef, counties, bbox.maxLng, bbox.minLat);

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
    console.log("finished "+STATE+" @", finished, "("+(finished.getTime()-started.getTime())/60000+")");
}


function addGrid(grids, grid, stateDef, countyDefs, minLon, minLat) {
    // if we have already covered this grid then nothing to do
    if (grids[grid]) {
        return grids;
    }

    const gridBounds = mgrs.inverse(grid);

    const nwLat = gridBounds[3];
    const nwLon = gridBounds[0];
    const ctrLat = (gridBounds[1] + gridBounds[3]) / 2;
    const ctrLon = (gridBounds[0] + gridBounds[2]) / 2;

    if (nwLat < minLat || nwLon > minLon) {
        // we've gone either farther east or south than our bounding box
        return grids;
    } else {
        const gridDef = {};

        // NOTE: regardless of whether this grid is within the state shape we want to add it to our grids so that
        //       we don't attempt to process this same grid again during our iteration
        grids[grid] = gridDef;

        // if this grid is within our designated state then try to map which counties it overlaps
        if (isGridInShape(grid, stateDef)) {
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

        // NOTE: in lat/lon coords 1/100 of a degree = 110m, so we are moving basically 1km
        //       this should put us pretty close to the center of the adjacent grid
        const gridEast = mgrs.forward([ctrLon + 0.009, ctrLat], 2);
        const gridSouth = mgrs.forward([ctrLon, ctrLat - 0.009], 2);

        // go east first
        const moreGrids = addGrid(grids, gridEast, stateDef, countyDefs, minLon, minLat);

        // then go south (and we are done)
        return addGrid(moreGrids, gridSouth, stateDef, countyDefs, minLon, minLat);
    }
}

function isGridInShape(grid, shape) {
    const polygons = shape.geometry.coordinates;

    const pt = mgrs.inverse(grid);
    const maxLon = pt[0];
    const minLat = pt[1];
    const minLon = pt[2];
    const maxLat = pt[3];

    // check if any of the 4 corners of the grid are within the shape
    // Hmmm.  It seems possible that we could miss counties because the shape of a county could enter and leave
    //        a grid on one of its edges without ever overlapping one of the corners.  May be better to change
    //        this to do a line intersection check instead of a point in polygon check, that way we effectively
    //        test all points along each edge of the grid.
    let result = false;
    let idx = 0;
    const points = [
        [maxLon, maxLat],
        [minLon, maxLat],
        [maxLon, minLat],
        [minLon, minLat]
    ];

    while( result === false && idx < points.length) {
        if( polygons.length === 1 ) {
            result = pointInPolygon(points[idx], polygons[0]);
        } else {
            // some shapes have multiple polygons, so we need to test them all
            // NOTE: in geojson a MultiPolygon has each member of its coordinates structured like a Polygon
            for( let k=0; k < polygons.length && result === false; k++ ) {
                const polygon = shape.geometry.type === "MultiPolygon" ? polygons[k][0] : polygons[k];
                result = pointInPolygon(points[idx], polygon);
            }
        }

        idx++;
    }

    // just check if any of the 4 sides of the grid interset the shape
    // if (result === false) {
    //     idx = 0;
    //     const sides = [
    //         turf.lineString([[maxLon, maxLat], [maxLon, minLat]]),
    //         turf.lineString([[maxLon, minLat], [minLon, minLat]]),
    //         turf.lineString([[minLon, minLat], [minLon, maxLat]]),
    //         turf.lineString([[minLon, maxLat], [maxLon, maxLat]])
    //     ];
    //     const polygon = turf.polygon([shape]);
    //     // ICK!  This is missing grids because it's possible that a very small portion of a county line pokes
    //     //       into a given grid somewhere along one of the edges but all 4 corners are NOT in the county
    //     // probably better if we can check if line intersects shape for all 4 sides of the grid
    //     while( result === false && idx < sides.length) {
    //         const intersection = turf.lineIntersect(sides[idx], polygon);
    //         // console.log(intersection);
    //         if (intersection && intersection.features.length > 0) {
    //             result = true;
    //         }

    //         idx++;
    //     }
    // }

    return result;
}


// this kicks us off
loadCounties();
