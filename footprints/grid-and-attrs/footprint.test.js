/* eslint-env jest */

const fp = require('./footprint')

test('adds area property', () => {
  const json = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-77.014904,38.816248],[-77.014842,38.816395],[-77.015056,38.816449],[-77.015117,38.816302],[-77.014904,38.816248]]]},"properties":{}}'
  const processed = fp.processFootprint(JSON.parse(json), 'DistrictofColumbia', {}, {})

  expect(processed.properties.area).toBeCloseTo(335.09419006265676)
})

test('adds UBID property', () => {
  const json = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-77.014904,38.816248],[-77.014842,38.816395],[-77.015056,38.816449],[-77.015117,38.816302],[-77.014904,38.816248]]]},"properties":{}}'
  const processed = fp.processFootprint(JSON.parse(json), 'DistrictofColumbia', {}, {})

  expect(processed.properties.ubid).toEqual('87C4RX8P+G2-1-1-1-1')
})
