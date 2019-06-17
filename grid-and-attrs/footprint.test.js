/* eslint-env jest */

const fp = require('./footprint')

const isAlphaNumeric = ch => {
  return ch.match(/^[a-z0-9]+$/i) !== null
}

const testFootprint = {
  'type': 'Feature',
  'geometry': {
    'type': 'Polygon',
    'coordinates': [[[-77.014904, 38.816248], [-77.014842, 38.816395], [-77.015056, 38.816449], [-77.015117, 38.816302], [-77.014904, 38.816248]]]
  },
  'properties': {}
}

const gridToCountyMapping = {
  '87C4RX00+': ['12345']
}

test('adds hash property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.hash).toEqual('ODdDNFJYOFArOjYxNDk1Njg2OQ')

  // we only want alphanumeric for the hash, so check that
  expect(isAlphaNumeric(processed.properties.hash)).toBe(true)
})

test('adds UBID property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.ubid).toEqual('87C4RX8P+G2-1-1-1-1')

  // decode the UBID to validate it?
})

test('adds state property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.state).toEqual('TestState')
})

test('adds county property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.county).toEqual('12345')

  // test between multiple possible counties
})

test('adds grid property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.grid).toEqual('87C4RX8P+')

  // should be exactly 9 characters, ending in a +
  expect(processed.properties.grid.length).toEqual(9)
  expect(processed.properties.grid.indexOf('+')).toEqual(8)
})

test('adds lat property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.lat).toBeCloseTo(38.816328)
})

test('adds lon property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.lon).toBeCloseTo(-77.014965)
})

test('adds area property', () => {
  const processed = fp.processFootprint(testFootprint, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.area).toBeCloseTo(335.09419006265676)
})

// handling of custom properties

test('retains custom footprint properties', () => {
  const processed = fp.processFootprint({
    ...testFootprint,
    properties: {
      height: 123,
      other: 'abc'
    }
  }, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.height).toEqual(123)
  expect(processed.properties.other).toEqual('abc')
})

test('lowercases custom footprint properties', () => {
  const processed = fp.processFootprint({
    ...testFootprint,
    properties: {
      Height: 123,
      OTHER: 'abc'
    }
  }, 'TestState', {}, gridToCountyMapping)

  expect(processed.properties.height).toEqual(123)
  expect(processed.properties.Height).toBe(undefined)
  expect(processed.properties.other).toEqual('abc')
})

// geometry repair

test('converts MultiPolygon to Polygon when possible', () => {
  const processed = fp.processFootprint({
    ...testFootprint,
    geometry: {
      'type': 'MultiPolygon',
      'coordinates': [[[[-77.014904, 38.816248], [-77.014842, 38.816395], [-77.015056, 38.816449], [-77.015117, 38.816302], [-77.014904, 38.816248]]]]
    }
  }, 'TestState', {}, gridToCountyMapping)

  expect(processed.geometry.type).toEqual('Polygon')
  expect(processed.geometry.coordinates[0][0]).toEqual([-77.014904, 38.816248])
})
