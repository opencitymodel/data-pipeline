package org.opencitymodel.citygml;

import org.apache.commons.lang3.ArrayUtils;
import org.citygml4j.factory.GMLGeometryFactory;
import org.citygml4j.model.gml.geometry.primitives.Polygon;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;



public class FootprintExtruder {

    private static final GMLGeometryFactory geom = new GMLGeometryFactory();


    // NOTE: we expect each point in the footprint coordinates to be of the form [longitude, latitude]
    public static List<Polygon> extrudeBuilding(Geometry geometry, double height) {
        List<Polygon> surfaces = new ArrayList<>();

        // floor - this is just our footprint @ height = 0
        surfaces.add(makePolygon(geometry.getCoordinates()[0], 0.0));

        // walls - each segment of our footprint extruded vertically to the height
        double[][] coords = geometry.getCoordinates()[0];
        for( int i=0; i < coords.length - 1; i++ ) {
            // take current point and next point as the 2 wall vertices we want to extrude
            // NOTE: since the last vertex in our coordinates ring is already the same as the first vertex
            //       we don't need to wrap around the array.  we simply stop at the end of the vertices.
            double[] ptA = coords[i];
            double[] ptB = coords[i+1];

            surfaces.add(makeWallPolygon(ptA, ptB, height));
        }

        // roof - same as our footprint, but with the height applied
        // NOTE: in order to properly orient the roof we need to reverse the coordinates in our footprint
        double[][] roofPoints = ArrayUtils.clone(geometry.getCoordinates()[0]);
        ArrayUtils.reverse(roofPoints);
        surfaces.add(makePolygon(roofPoints, height));

        return surfaces;
    }


    public static Polygon makePolygon(double[][] points, double height) {
        try {
            List<Double> points3d = new ArrayList<>();
            for( int i=0; i < points.length; i++ ) {
                double lon = points[i][0];
                double lat = points[i][1];

                points3d.addAll(Arrays.asList(lon, lat, height));
            }

            return geom.createLinearPolygon(points3d, 3);
        } catch(Exception ex) {
            throw new RuntimeException("Error making polygon", ex);
        }
    }


    public static Polygon makeWallPolygon(double[] ptA, double[] ptB, double height) {
        try {
            List<Double> points3d = new ArrayList<>();

            points3d.addAll(Arrays.asList(ptA[0], ptA[1], 0.0));
            points3d.addAll(Arrays.asList(ptA[0], ptA[1], height));
            points3d.addAll(Arrays.asList(ptB[0], ptB[1], height));
            points3d.addAll(Arrays.asList(ptB[0], ptB[1], 0.0));

            return geom.createLinearPolygon(points3d, 3);
        } catch(Exception ex) {
            throw new RuntimeException("Error making polygon", ex);
        }
    }

}
