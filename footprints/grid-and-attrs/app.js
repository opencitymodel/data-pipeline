const fs = require('fs')
const mkdirp = require('mkdirp')
const readline = require('readline')
const yargs = require('yargs')

const fp = require('./footprint')
const stateCodes = require('./state-codes')

// This script takes in a file of GeoJSON features (1 per line) and calculates a
// series of custom attributes for the object then writes out a new JSON object.

// this will parse our command line options
const appArgs = yargs
  .example('node $0 -s California -i ./California.txt -o ./data/grid -c ./California.geo.json -m California-grid-to-county.json')
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
  .option('grid-to-county-file', {
    alias: 'm',
    demandOption: true,
    describe: 'grid-to-county mapping file',
    requiresArg: true,
    type: 'string'
  })
  .help()
  .argv

function writeFootprint (state, grid, outdir, building) {
  // take just the first 4 characters of the PlusCode grid, which should provide a ~110km area
  const zone = grid.substring(0, 4)

  // make sure our folder path exists, otherwise we can't open up the actual files
  // NOTE: throwing errors here will terminate the whole execution, which is fine because
  //       it's clearly a serious issue if we can't safely write our data safely
  mkdirp(outdir + '/' + state, function (err) {
    if (err) {
      throw new Error(`error creating directory ${outdir}/${state}: ${err}`)
    } else {
      fs.appendFile(`${outdir}/${state}/${zone}.txt`, JSON.stringify(building) + '\n', function (err) {
        if (err) throw new Error(`error writing to ${grid}: ${err}`)
      })
    }
  })
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

async function loadGridToCountyMapping (gridToCountyFile) {
  return new Promise((resolve, reject) => {
    const gridToCountyMapping = {}

    // open up our input file and start reading line by line
    const stream = readline.createInterface({
      input: fs.createReadStream(gridToCountyFile, { encoding: 'utf-8' })
    })

    stream.on('line', function (line) {
      const mapping = JSON.parse(line)
      gridToCountyMapping[mapping.grid] = mapping.counties
    })

    stream.on('close', () => {
      console.log('finished loading grid->county mapping')

      resolve(gridToCountyMapping)
    })
  })
}

function processFootprints (args, countyShapes, gridToCountyMapping) {
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

      const footprint = fp.processFootprint(JSON.parse(line), args.state, countyShapes, gridToCountyMapping)

      // add the footprint to output file
      writeFootprint(args.state, footprint.properties.grid, args.outputFolder, footprint)
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

  const countyGeocodeIndex = await loadGridToCountyMapping(args.gridToCountyFile)

  processFootprints(args, countyShapes, countyGeocodeIndex)
}

// this kicks things off and runs through everything
doWork(appArgs)
