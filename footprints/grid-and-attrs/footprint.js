const _ = require('underscore')
const geolib = require('geolib')
const OpenLocationCode = require('open-location-code').OpenLocationCode
const pointInPolygon = require('point-in-polygon')
const turfArea = require('@turf/area')
const turfHelpers = require('@turf/helpers')

const repair = require('./repair')

// taken from https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
// should be good enough when coupled together with the MGRS grid
function quickHash (str, grid) {
  var quickHashVal = 0
  if (str.length === 0) {
    return quickHashVal
  }
  for (var quickHashInc = 0; quickHashInc < str.length; quickHashInc++) {
    var char = str.charCodeAt(quickHashInc)
    quickHashVal = ((quickHashVal << 5) - quickHashVal) + char
    quickHashVal = quickHashVal & quickHashVal // Convert to 32bit integer
  }

  // lastly lets base64 encode so we get a string
  const base64 = Buffer.from(`${grid}:${quickHashVal}`).toString('base64')

  // remove base64 padding because we only want alphanumeric values
  return base64.replace(/=/g, '')
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
  return centroidOpenlocationcode + '-' + deltaNorth + '-' + deltaEast + '-' + deltaSouth + '-' + deltaWest
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

module.exports.processFootprint = (footprint, state, countyShapes, mgrsToCountyMapping) => {
  // we don't support actual MultiPolygon shapes, so either bail or convert to Polygon if we can
  if (footprint.geometry.type === 'MultiPolygon') {
    if (footprint.geometry.coordinates.length > 1) {
      throw new Error('MULTIPOLYGON')
    } else {
      // convert to Polygon given this isn't really a MultiPolygon
      footprint.geometry.type = 'Polygon'
      footprint.geometry.coordinates = footprint.geometry.coordinates[0]
    }
  }

  // validate and repair geometry if needed
  try {
    footprint.geometry = repair.repairGeometry(footprint.geometry)
  } catch (geomError) {
    throw new Error('GEOMETRY_ERROR', geomError)
  }

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

  // calculate Plus Code grid @ code length = 8 (roughly 275mx275m grid)
  const openloc = new OpenLocationCode()
  const grid = openloc.encode(center.lat, center.lon, 8)

  // hash the geometry coordinates into a unique value for the building
  const hashStr = footprint.geometry.coordinates[0].reduce(function (acc, val) {
    return acc + val
  }, '')
  const hash = quickHash(hashStr, grid)

  // calculate UBID for the footprint
  const bboxNortheast = { latitude: bbox.maxLat, longitude: bbox.maxLng }
  const bboxSouthwest = { latitude: bbox.minLat, longitude: bbox.minLng }
  const bid = ubid(center, bboxNortheast, bboxSouthwest)

  // reverse geocode to determine county
  let countyId = null
  const possibleCounties = mgrsToCountyMapping[grid]
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
      console.log('MISSING_MATCHED', grid, countyId, center.lat + ',' + center.lon)
    } else {
      console.log('NO_COUNTY', grid, center.lat + ',' + center.lon)
    }
  }

  // add all of our new properties, and rename all existing props to lowercase for consistency
  let props = Object.keys(footprint.properties).reduce((c, k) => {
    c = c[k.toLowerCase()] = footprint.properties[k]
    return c
  }, {})

  footprint.properties = _.extend(props, {
    hash,
    ubid: bid,
    state,
    county: countyId,
    grid,
    lat: center.lat,
    lon: center.lon,
    area
  })

  return footprint
}
