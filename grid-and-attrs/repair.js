const _ = require('underscore')
const eachCons = require('each-cons')

module.exports = {
  // validate polygon and attempt to repair common issues
  //
  // if the geometry is deemed to be invalid and non-repairable for any reason then we should throw
  // an error back to the caller detailing what the problem was with the geometry
  //
  // SEE: http://desktop.arcgis.com/en/arcmap/10.3/tools/data-management-toolbox/repair-geometry.htm
  repairGeometry: geometry => {
    //  Duplicate Vertices
    if (_.some(geometry.coordinates, ring => {
      return _.some(eachCons(ring, 2), coordsPair => {
        return coordsPair[0][0] === coordsPair[1][0] && coordsPair[0][1] === coordsPair[1][1]
      })
    })) {
      // console.log("duplicate coordinates found in polygon ring", geometry.coordinates);
      const coordinates = geometry.coordinates.map(ring => {
        // only keep unique points in the polygon
        const uniqueRing = _.uniq(ring, true, c => c[0] + c[1])
        // the above will strip out the final point in the polygon which is the same as the first point, so add it back
        return [ ...uniqueRing, uniqueRing[0] ]
      })

      geometry = { ...geometry, coordinates }
    }

    return geometry
  }
}
