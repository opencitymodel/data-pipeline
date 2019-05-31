const _ = require('underscore')
const fs = require('fs')
const geolib = require('geolib')
const mkdirp = require('mkdirp')
const mgrs = require('mgrs')
const OpenLocationCode = require('open-location-code').OpenLocationCode
const pointInPolygon = require('point-in-polygon')
const readline = require('readline')
const turfArea = require('@turf/area')
const turfHelpers = require('@turf/helpers')
const yargs = require('yargs')

const stateCodes = require('./state-codes')
const repair = require('./repair')

// This script takes in a file of GeoJSON features (1 per line) and calculates a
// series of custom attributes for the object then writes out a new JSON object.

// this will parse our command line options
const appArgs = yargs
  .example('node $0 -s California -i ./California.txt -o ./data/grid -c ./California.geo.json -m California-mgrs-to-county.json')
  .option('input-file', {
    alias: 'i',
    demandOption: true,
    describe: 'file of GeoJSON to process',
    requiresArg: true,
    type: 'string'
  })
  .option('state', {
    alias: 's',
    demandOption: true,
    describe: 'US state being processed',
    requiresArg: true,
    type: 'string'
  })
  .option('output-folder', {
    alias: 'o',
    demandOption: true,
    describe: 'where the output files are written',
    requiresArg: true,
    type: 'string'
  })
  .option('county-shapes', {
    alias: 'c',
    demandOption: true,
    describe: 'GeoJSON file of US county shapes',
    requiresArg: true,
    type: 'string'
  })
  .option('mgrs-to-county-file', {
    alias: 'm',
    demandOption: true,
    describe: 'mgrs-to-county mapping file',
    requiresArg: true,
    type: 'string'
  })
  .help()
  .argv

// this breaks a 1km MGRS identifier into 3 parts
const MGRS_REGEX = /([0-9A-Z]+)([A-Z]{2})([0-9]{4})/

function writeFootprint (state, mgrsGrid, outdir, building) {
  // break apart mgrs and create a path on the fs for <GZD>/<GZD><GSID>/<MGRS>.txt
  const match = MGRS_REGEX.exec(mgrsGrid)
  const gzd = match[1]
  const gsid = match[2]
  // const zone10k = match[3].substring(0, 1) + match[3].substring(2, 3);

  // make sure our folder path exists, otherwise we can't open up the actual files
  // NOTE: throwing errors here will terminate the whole execution, which is fine because
  //       it's clearly a serious issue if we can't safely write our data safely
  mkdirp(outdir + '/' + state, function (err) {
    if (err) {
      throw new Error(`error creating directory ${outdir}/${state}: ${err}`)
    } else {
      // TODO: this could probably be more efficient
      fs.appendFile(`${outdir}/${state}/${gzd}${gsid}.txt`, JSON.stringify(building) + '\n', function (err) {
        if (err) throw new Error(`error writing to ${mgrsGrid}: ${err}`)
      })
    }
  })
}

// taken from https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
// should be good enough when coupled together with the MGRS grid
function quickHash (str) {
  var quickHashVal = 0
  if (str.length === 0) {
    return quickHashVal
  }
  for (var quickHashInc = 0; quickHashInc < str.length; quickHashInc++) {
    var char = str.charCodeAt(quickHashInc)
    quickHashVal = ((quickHashVal << 5) - quickHashVal) + char
    quickHashVal = quickHashVal & quickHashVal // Convert to 32bit integer
  }
  return quickHashVal
}

// adapted from the encode() function here https://github.com/pnnl/buildingid/blob/master/buildingid/v3.py#L90
function ubid (center, northeast, southwest) {
  const openloc = new OpenLocationCode()

  // Encode the OLCs for the northeast and southwest corners of the minimal
  // bounding box for the building footprint.
  const northeastOpenlocationcode = openloc.encode(northeast.latitude, northeast.longitude)
  const southwestOpenlocationcode = openloc.encode(southwest.latitude, southwest.longitude)

  // Encode the OLC for the centroid of the building footprint.
  const centroidOpenlocationcode = openloc.encode(center.lat, center.lon)

  // Decode the OLCs for the northeast and southwest corners of the minimal
  // bounding box for the building footprint.
  const northeastOpenlocationcodeCodeArea = openloc.decode(northeastOpenlocationcode)
  const southwestOpenlocationcodeCodeArea = openloc.decode(southwestOpenlocationcode)

  // Decode the OLC for the centroid of the building footprint.
  const centroidOpenlocationcodeCodeArea = openloc.decode(centroidOpenlocationcode)

  // Calculate the size of the OLC for the centroid of the building footprint
  // in decimal degree units.
  const height = centroidOpenlocationcodeCodeArea.latitudeHi - centroidOpenlocationcodeCodeArea.latitudeLo
  const width = centroidOpenlocationcodeCodeArea.longitudeHi - centroidOpenlocationcodeCodeArea.longitudeLo

  // Calculate the Chebyshev distances to the northern, eastern, southern and
  // western of the OLC bounding box for the building footprint.
  const deltaNorth = Math.round((northeastOpenlocationcodeCodeArea.latitudeHi - centroidOpenlocationcodeCodeArea.latitudeHi) / height)
  const deltaEast = Math.round((northeastOpenlocationcodeCodeArea.longitudeHi - centroidOpenlocationcodeCodeArea.longitudeHi) / width)
  const deltaSouth = Math.round((centroidOpenlocationcodeCodeArea.latitudeLo - southwestOpenlocationcodeCodeArea.latitudeLo) / height)
  const deltaWest = Math.round((centroidOpenlocationcodeCodeArea.longitudeLo - southwestOpenlocationcodeCodeArea.longitudeLo) / width)

  // Construct and return the UBID code.
  return centroidOpenlocationcodeCodeArea + '-' + deltaNorth + '-' + deltaEast + '-' + deltaSouth + '-' + deltaWest
}

// test if a given point falls within the shape of a county
// NOTE: we only test if the point is inside the outer linear-ring of each polygon, so we don't account for holes in polygons
function pointInCounty (point, countyDef) {
  if (countyDef.geometry.type === 'Polygon' && countyDef.geometry.coordinates.length > 0) {
    return pointInPolygon(point, countyDef.geometry.coordinates[0])
  } else if (countyDef.geometry.type === 'MultiPolygon') {
    // shapes with multiple polygons, so we need to test them all
    // NOTE: in geojson a MultiPolygon has each member of its coordinates structured like a Polygon
    for (let k = 0; k < countyDef.geometry.coordinates.length; k++) {
      const polygon = countyDef.geometry.coordinates[k]
      if (pointInPolygon(point, polygon[0])) return true
    }
  }

  return false
}

async function loadCountyShapes (shapesFile, state) {
  return new Promise((resolve, reject) => {
    const countyShapes = {}

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
      input: fs.createReadStream(shapesFile, { encoding: 'utf-8' })
    })

    stream.on('line', function (line) {
      if (line.endsWith(',')) {
        line = line.substring(0, line.length - 1)
      }
      const countyDef = JSON.parse(line)

      // extract a couple things
      const stateCode = countyDef.properties.STATEFP
      const stateName = stateCodes[stateCode].name
      const msfpStateName = stateName.replace(/ /g, '')

      // we only care about the counties for the state we are processing
      if (msfpStateName === state) {
        countyShapes[countyDef.properties.GEOID] = countyDef
      }
    })

    stream.on('close', () => {
      console.log('finished loading county shapes')

      resolve(countyShapes)
    })
  })
}

async function loadMgrsToCountyMapping (mgrsToCountyFile) {
  return new Promise((resolve, reject) => {
    const mgrsToCountyMapping = {}

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
      input: fs.createReadStream(mgrsToCountyFile, { encoding: 'utf-8' })
    })

    stream.on('line', function (line) {
      const mapping = JSON.parse(line)
      mgrsToCountyMapping[mapping.mgrs] = mapping.counties
    })

    stream.on('close', () => {
      console.log('finished loading mgrs->county mapping')

      resolve(mgrsToCountyMapping)
    })
  })
}

function processFootprint (footprint, state, countyShapes, mgrsToCountyMapping) {
  // we don't support actual MultiPolygon shapes, so either bail or convert to Polygon if we can
  if (footprint.geometry.type === 'MultiPolygon') {
    if (footprint.geometry.coordinates.length > 1) {
      throw new Error('UNSUPPORTED_MULTIPOLYGON')
    } else {
      // convert to Polygon given this isn't really a MultiPolygon
      footprint.geometry.type = 'Polygon'
      footprint.geometry.coordinates = footprint.geometry.coordinates[0]
    }
  }

  // validate and repair geometry if needed
  try {
    // const origGeometry = footprint.geometry
    footprint.geometry = repair.repairGeometry(footprint.geometry)
    // if (origGeometry !== footprint.geometry) repairedPolygons++
  } catch (geomError) {
    throw new Error('GEOMETRY_ERROR', geomError)
  }

  // hash the geometry coordinates into a unique signature for the building
  const hashStr = footprint.geometry.coordinates[0].reduce(function (acc, val) {
    return acc + val
  }, '')
  const signature = quickHash(hashStr)

  // calculate centroid
  const ctr = geolib.getCenter(footprint.geometry.coordinates[0].map(p => {
    return { longitude: p[0], latitude: p[1] }
  }))
  // not sure why, but the centroid funtion is returning values as strings =(
  const center = { lat: parseFloat(ctr.latitude), lon: parseFloat(ctr.longitude) }

  // calculate bounding box
  const bbox = geolib.getBounds(footprint.geometry.coordinates[0].map(p => {
    return { longitude: p[0], latitude: p[1] }
  }))

  // calculate area
  const turfPoly = turfHelpers.polygon(footprint.geometry.coordinates)
  const area = turfArea.default(turfPoly)

  // calculate MGRS grid @ 1km resolution
  const mgrsGrid = mgrs.forward([center.lon, center.lat], 2)

  // calculate UBID for the footprint
  const bboxNortheast = { latitude: bbox.maxLat, longitude: bbox.maxLng }
  const bboxSouthwest = { latitude: bbox.minLat, longitude: bbox.minLng }
  const bid = ubid(center, bboxNortheast, bboxSouthwest)

  // reverse geocode to determine county
  let countyId = null
  const possibleCounties = mgrsToCountyMapping[mgrsGrid]
  if (possibleCounties && possibleCounties.length > 0) {
    if (possibleCounties.length === 1) {
      // there is only 1 county for this grid so we are done
      countyId = possibleCounties[0]
    } else {
      countyId = _.find(possibleCounties, county => {
        return pointInCounty([center.lon, center.lat], countyShapes[county])
      })
    }
  } else {
    // if possibleCounties is non-existant then we missed this grid and we need to figure it out right now
    countyId = _.find(Object.keys(countyShapes), county => {
      return pointInCounty([center.lon, center.lat], countyShapes[county])
    })

    if (countyId) {
      console.log('MISSING_MATCHED', mgrsGrid, countyId, center.lat + ',' + center.lon)
    } else {
      console.log('NO_COUNTY', mgrsGrid, center.lat + ',' + center.lon)
    }
  }

  // add all of our new properties, and rename all existing props to lowercase for consistency
  let props = Object.keys(footprint.properties).reduce((c, k) => {
    c = c[k.toLowerCase()] = footprint.properties[k]
    return c
  }, {})

  footprint.properties = _.extend(props, {
    sig: signature,
    ubid: bid,
    state,
    county: countyId,
    lat: center.lat,
    lon: center.lon,
    mgrs: mgrsGrid,
    area
  })

  return footprint
}

function processFootprints (args, countyShapes, mgrsToCountyMapping) {
  const started = new Date()
  console.log('Starting ' + args.state + ' @', started)

  // open up our input file and start reading line by line
  const stream = readline.createInterface({
    input: fs.createReadStream(args.inputFile, { encoding: 'utf-8' })
  })

  let total = 0
  let fpErrors = 0
  let multiPolygons = 0
  let badPolygons = 0
  let repairedPolygons = 0
  stream.on('line', function (line) {
    try {
      total++

      if (line.endsWith(',')) {
        line = line.substring(0, line.length - 1)
      }

      const footprint = processFootprint(JSON.parse(line), args.state, countyShapes, mgrsToCountyMapping)

      // add the footprint to output file
      writeFootprint(args.state, footprint.properties.mgrs, args.outputFolder, footprint)
    } catch (error) {
      console.log('error processing footprint', error, line)
      fpErrors++
    }
  })

  stream.on('close', () => {
    console.log('GENERAL_ERRORS', fpErrors)
    console.log('MULTI_POLYGONS', multiPolygons)
    console.log('BAD_POLYGONS', badPolygons)
    console.log('REPAIRED_POLYGONS', repairedPolygons)
    console.log('TOTAL_BUILDINGS', total)

    const finished = new Date()
    console.log('Finished ' + args.state + ' @', finished, '(' + Math.round((finished.getTime() - started.getTime()) / 60000) + 'm)')
  })
}

async function doWork (args) {
  const countyShapes = await loadCountyShapes(args.countyShapes, args.state)

  const countyGeocodeIndex = await loadMgrsToCountyMapping(args.mgrsToCountyFile)

  processFootprints(args, countyShapes, countyGeocodeIndex)
}

// this kicks things off and runs through everything
doWork(appArgs)
