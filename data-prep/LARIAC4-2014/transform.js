fs = require('fs');
proj4 = require('proj4');
readline = require('readline');


const INFILE = process.argv[2];
const OUTFILE = process.argv[3];
const SOURCE_CRS = process.argv[4];

const CRS_PROJ = {
    "2229": "+proj=lcc +lat_1=35.46666666666667 +lat_2=34.03333333333333 +lat_0=33.5 +lon_0=-118 +x_0=2000000.0001016 +y_0=500000.0001016001 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs"
}


const crsTransform = proj4(CRS_PROJ[SOURCE_CRS], 'EPSG:4326');


const transformPolygonCoords = coords => {
    // simply perform the transform on the coords of each linear ring of our polygon
    // ring looks like [[x, y], [x, y], [x, y], ...]
    return coords.map(ring => {
        return ring.map(coord => crsTransform.forward(coord));
    });
}

const transformGeom = geom => {
    if (geom.type === "MultiPolygon") {
        return {
            ...geom,
            coordinates: geom.coordinates.map(polyCoords => transformPolygonCoords(polyCoords))
        }

    } else if (geom.type === "Polygon") {
        return {
            ...geom,
            coordinates: transformPolygonCoords(geom.coordinates)
        }

    } else {
        // don't know how to handle other coords
        console.warn(`Don't know how to handle '${geom.type}' type geometries`);
        return geom;
    }
}

const normalizeProperties = props => {
  if ( props.HEIGHT ) {
    // convert from ft -> m
    props.HEIGHT = props.HEIGHT / 3.281
  }

  return props
}

const writeFootprint = footprint => {
    fs.appendFile(OUTFILE, JSON.stringify(footprint)+"\n", function (err) {
        if (err) throw(err);
    });
}


const readFootprints = () => {

    if ( !CRS_PROJ[SOURCE_CRS] ) {
        console.error("Couldn't find specified transform");
        process.exit(1);
    }

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
        input: fs.createReadStream(INFILE, { encoding: "utf-8"})
    });

    stream.on("line", function(line) {
        if (line.endsWith(",")) {
            line = line.substring(0, line.length - 1);
        }

        const footprint = JSON.parse(line);

        // modify the coordinates of the footprint geometry
        footprint.geometry = transformGeom(footprint.geometry);

        // normalize property values
        footprint.properties = normalizeProperties(footprint.properties);

        writeFootprint(footprint);
    });

    stream.on("close", () => {
        console.log("finished");
    });
}

readFootprints();
