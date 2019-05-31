const _ = require('underscore')
const fs = require('fs')
const geolib = require('geolib')
const OpenLocationCode = require('open-location-code').OpenLocationCode
const readline = require('readline')
const turf = require('@turf/turf')
const turfIntersect = require('@turf/intersect').default

const stateCodes = require('./state-codes')

// we must have a file for us to process
if (process.argv.length < 3) {
  console.log('error: no state shapefile specified')
  console.log('usage: node app.js <state-shapefile> <county-shapefile> <msfp-state>')
  process.exit(1)
}

// we must have a file for us to process
if (process.argv.length < 4) {
  console.log('error: no state specified')
  console.log('usage: node app.js <state-shapefile> <county-shapefile> <msfp-state>')
  process.exit(1)
}

const COUNTY_SHAPES_FILE = process.argv[2]
const STATE = process.argv[3]

const OUTPUT_FILE = './' + STATE + '-grid-to-counties.txt'

function loadCounties () {
  const counties = []

  // open up our input file and start reading line by line
  const stream = readline.createInterface({
    input: fs.createReadStream(COUNTY_SHAPES_FILE, { encoding: 'utf-8' })
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

    countyDef.msfp = msfpStateName
    counties.push(countyDef)
  })

  stream.on('close', () => {
    console.log('finished loading counties shapefile', counties.length)

    // pull out just the state we are working on
    const countiesByState = _.groupBy(counties, 'msfp')

    // here we go
    processState(countiesByState[STATE])
  })
}

// build a mapping of PlusCode grid -> [county, county, ...] for a given state
function processState (countyDefs) {
  const started = new Date()
  console.log('Starting ' + STATE + ' @', started)

  const grids = {}

  // iterate over each county in the state
  countyDefs.forEach(countyDef => {
    const countyStart = new Date()
    console.log(`County = ${countyDef.properties.NAME}`)

    // some counties have multiple polygons, so go through them 1-by-1
    const countyPolygons = getCountyPolygons(countyDef)
    countyPolygons.forEach(countyPolygon => {
      const polygonStart = new Date()

      // determine the bounding box of our polygon
      const bbox = geolib.getBounds(countyPolygon.map(p => {
        return { longitude: p[0], latitude: p[1] }
      }))
      console.log('  bbox', '(' + bbox.minLng + ',' + bbox.minLat + ',' + bbox.maxLng + ',' + bbox.maxLat + ')')

      // determine all of the possible grids within our bounding box
      const possibleGrids = findGrids(bbox)
      const findGridsTime = Math.round((new Date().getTime() - polygonStart.getTime()) / 1000)
      console.log(`    found=${possibleGrids.size}  (${findGridsTime}s)`)

      // we are testing a specific county polygon, so set that up
      const countyPolygonShape = {
        geometry: {
          type: 'Polygon',
          coordinates: [countyPolygon]
        }
      }

      // iterate over the possible grids and test if they fall within the polygon
      const gridTestStart = new Date()
      let added = 0
      possibleGrids.forEach(grid => {
        const gridDef = grids[grid] || { grid, counties: [] }

        // test that the grid falls within the polygon
        if (isGridInShape(grid, countyPolygonShape)) {
          added++
          gridDef.counties.push(countyDef.properties.GEOID)

          // make sure we assign the updated grid
          grids[grid] = gridDef
        }
      })

      const bboxTime = Math.round((new Date().getTime() - gridTestStart.getTime()) / 1000)
      console.log(`    added=${added}  (${bboxTime}s)`)
    })

    const countyTime = Math.round((new Date().getTime() - countyStart.getTime()) / 1000)
    console.log(`  ${countyDef.properties.NAME} county completed in ${countyTime}s`)
  })

  // write valid grids out into a file
  const outstream = fs.createWriteStream(OUTPUT_FILE)
  Object.keys(grids).forEach(grid => {
    const gridDef = grids[grid]

    if (gridDef.grid) {
      outstream.write(JSON.stringify(gridDef) + '\n', 'utf8')
    }
  })
  outstream.end()

  const finished = new Date()
  const stateFinished = Math.round((finished.getTime() - started.getTime()) / 60000)
  console.log('Finished ' + STATE + ' @', finished, '(' + stateFinished + 'm)')
}

// find all of the grids within a given bounding box
function findGrids (bbox) {
  const grids = new Set()

  // these are the termination points of the bbox, which we pad a little
  const bboxMinLon = bbox.maxLng + 0.01
  const bboxMinLat = bbox.minLat - 0.01

  let lat = bbox.maxLat + 0.01
  let lon = bbox.minLng - 0.01
  while (lat > bboxMinLat) {
    while (lon < bboxMinLon) {
      // use PlusCode(8) grids which are 0.0025 degrees long (~275m)
      const openloc = new OpenLocationCode()
      const grid = openloc.encode(lat, lon, 8)

      grids.add(grid)

      // move east
      lon = lon + 0.0025
    }

    // reset lon and move lat south
    lon = bbox.minLng - 0.01
    lat = lat - 0.0025
  }

  return grids
}

// enumerate the bounding boxes for each shape
function getCountyPolygons (countyDef) {
  // NOTE: we are only considering the outer line-ring of each polygon since that's all we need
  if (countyDef.geometry.type === 'Polygon') {
    return [countyDef.geometry.coordinates[0]]
  } else if (countyDef.geometry.type === 'MultiPolygon') {
    return countyDef.geometry.coordinates.map(polygon => polygon[0])
  }
}

// Test if a given grid lies within (any part) of a given county shape
function isGridInShape (grid, shape) {
  try {
    const openloc = new OpenLocationCode()
    const pt = openloc.decode(grid)

    const maxLon = pt.longitudeHi
    const minLat = pt.latitudeLo
    const minLon = pt.longitudeLo
    const maxLat = pt.latitudeHi

    // NOTE: first and last vertex must be equivalent to be a closed polygon and we need to start on the left most vertex
    const box = turf.polygon([[[minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat], [minLon, maxLat]]])

    if (shape.geometry.type === 'Polygon') {
      const countyPolygon = turf.polygon(shape.geometry.coordinates)
      if (turfIntersect(box, countyPolygon)) return true
    } else if (shape.geometry.type === 'MultiPolygon') {
      // test each polygon
      for (let i = 0; i < shape.geometry.coordinates.length; i++) {
        const countyPolygon = turf.polygon(shape.geometry.coordinates[i])
        if (turfIntersect(box, countyPolygon)) return true
      }
    }

    return false
  } catch (err) {
    console.log('error testing grid', grid, err)
    return false
  }
}

// this kicks us off
loadCounties()
