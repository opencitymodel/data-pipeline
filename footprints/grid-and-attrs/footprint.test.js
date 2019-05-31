/* eslint-env jest */

const fp = require('./footprint')

const isAlphaNumeric = ch => {
  return ch.match(/^[a-z0-9]+$/i) !== null
}

test('adds area property', () => {
  const json = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-77.014904,38.816248],[-77.014842,38.816395],[-77.015056,38.816449],[-77.015117,38.816302],[-77.014904,38.816248]]]},"properties":{}}'
  const processed = fp.processFootprint(JSON.parse(json), 'DistrictofColumbia', {}, {})

  expect(processed.properties.area).toBeCloseTo(335.09419006265676)
})

test('adds grid property', () => {
  const json = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-77.014904,38.816248],[-77.014842,38.816395],[-77.015056,38.816449],[-77.015117,38.816302],[-77.014904,38.816248]]]},"properties":{}}'
  const processed = fp.processFootprint(JSON.parse(json), 'DistrictofColumbia', {}, {})

  expect(processed.properties.grid).toEqual('87C4RX8P+')

  // should be exactly 9 characters, ending in a +
  expect(processed.properties.grid.length).toEqual(9)
  expect(processed.properties.grid.indexOf('+')).toEqual(8)
})

test('adds hash property', () => {
  const json = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-77.014904,38.816248],[-77.014842,38.816395],[-77.015056,38.816449],[-77.015117,38.816302],[-77.014904,38.816248]]]},"properties":{}}'
  const processed = fp.processFootprint(JSON.parse(json), 'DistrictofColumbia', {}, {})

  expect(processed.properties.hash).toEqual('ODdDNFJYOFArOjYxNDk1Njg2OQ')

  // we only want alphanumeric for the hash, so check that
  expect(isAlphaNumeric(processed.properties.hash)).toBe(true)
})

test('adds UBID property', () => {
  const json = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-77.014904,38.816248],[-77.014842,38.816395],[-77.015056,38.816449],[-77.015117,38.816302],[-77.014904,38.816248]]]},"properties":{}}'
  const processed = fp.processFootprint(JSON.parse(json), 'DistrictofColumbia', {}, {})

  expect(processed.properties.ubid).toEqual('87C4RX8P+G2-1-1-1-1')
})
