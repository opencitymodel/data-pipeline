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
        surfaces.add(makePolygon(geometry.getCoordinates(), 0.0));

        // walls - each segment of our footprint extruded vertically to the height
        // each member of geometry.getCoordinates() represents a linear ring that we need to extrude all walls for
        for ( double[][] coords : geometry.getCoordinates() ) {
            // this extrudes the walls for a single linear ring
            for ( int i=0; i < coords.length - 1; i++ ) {
                // take current point and next point as the 2 wall vertices we want to extrude
                // NOTE: since the last vertex in our coordinates ring is already the same as the first vertex
                //       we don't need to wrap around the array.  we simply stop at the end of the vertices.
                double[] ptA = coords[i];
                double[] ptB = coords[i+1];

                surfaces.add(makeWallPolygon(ptA, ptB, height));
            }
        }

        // roof - same as our footprint, but with the height applied
        // NOTE: in order to properly orient the roof we need to reverse the coordinates in our footprint
        double[][][] roofPoints = ArrayUtils.clone(geometry.getCoordinates());
        for ( int k=0; k < roofPoints.length; k++ ) {
            ArrayUtils.reverse(roofPoints[k]);
        }
        surfaces.add(makePolygon(roofPoints, height));

        return surfaces;
    }


    public static Polygon makePolygon(double[][][] polygon, double height) {
        try {
            double[][] allRings = new double[polygon.length][];

            for ( int i=0; i < polygon.length; i++ ) {
                double[][] ring = polygon[i];

                List<Double> points3d = new ArrayList<>();
                for( int k=0; k < ring.length; k++ ) {
                    double lon = ring[k][0];
                    double lat = ring[k][1];

                    points3d.addAll(Arrays.asList(lon, lat, height));
                }

                // ugh.  dealing with types in Java =(
                double[] posList = new double[points3d.size()];
                for ( int x=0; x < points3d.size(); x++ ) {
                    posList[x] = points3d.get(x);
                }

                allRings[i] = posList;
            }

            return geom.createLinearPolygon(allRings, 3);
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
