package org.opencitymodel.citygml;

import org.citygml4j.model.gml.geometry.primitives.AbstractRingProperty;
import org.citygml4j.model.gml.geometry.primitives.LinearRing;
import org.citygml4j.model.gml.geometry.primitives.Polygon;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;


public class FootprintExtruderTest {

    private double[][] outerRing = {{0,0}, {50,0}, {50,50}, {0,50}, {0,0}};
    private String outerRingExpected = "[0.0, 0.0, 0.0, 50.0, 0.0, 0.0, 50.0, 50.0, 0.0, 0.0, 50.0, 0.0, 0.0, 0.0, 0.0]";

    private double[][] innerRing1 = {{10,10}, {20,10}, {20,20}, {10,20}, {10,10}};
    private String innerRing1Expected = "[0.0, 0.0, 0.0, 50.0, 0.0, 0.0, 50.0, 50.0, 0.0, 0.0, 50.0, 0.0, 0.0, 0.0, 0.0]";

    private double[][] innerRing2 = {{30,30}, {40,30}, {40,40}, {30,40}, {30,30}};

    private double[][][] coordsNoHoles = {outerRing};
    private double[][][] coordsOneHole = {outerRing, innerRing1};
    private double[][][] coordsTwoHoles = {outerRing, innerRing1, innerRing2};

    private final Geometry geomNoHoles = new Geometry("Polygon", coordsNoHoles);
    private final Geometry geomOneHole = new Geometry("Polygon", coordsOneHole);
    private final Geometry geomTwoHoles = new Geometry("Polygon", coordsTwoHoles);

    // position lists for walls 3d solid
    private String[] wallOuterRingExpected = {
            "[0.0, 0.0, 0.0, 0.0, 0.0, 3.0, 50.0, 0.0, 3.0, 50.0, 0.0, 0.0, 0.0, 0.0, 0.0]",
            "[50.0, 0.0, 0.0, 50.0, 0.0, 3.0, 50.0, 50.0, 3.0, 50.0, 50.0, 0.0, 50.0, 0.0, 0.0]",
            "[50.0, 50.0, 0.0, 50.0, 50.0, 3.0, 0.0, 50.0, 3.0, 0.0, 50.0, 0.0, 50.0, 50.0, 0.0]",
            "[0.0, 50.0, 0.0, 0.0, 50.0, 3.0, 0.0, 0.0, 3.0, 0.0, 0.0, 0.0, 0.0, 50.0, 0.0]"
    };

    // position lists for roofs of 3d solid -- remember, this should be reversed from the original footprint
    private String roofOuterRingExpected = "[0.0, 0.0, 3.0, 0.0, 50.0, 3.0, 50.0, 50.0, 3.0, 50.0, 0.0, 3.0, 0.0, 0.0, 3.0]";


    // create a simple polygon
    @Test
    public void makePolygonNoHoles() {
        Polygon poly = FootprintExtruder.makePolygon(geomNoHoles.getCoordinates()[0], 0);

        assertEquals(outerRingExpected, ((LinearRing) poly.getExterior().getRing()).toList3d().toString());
        assertEquals(0, poly.getInterior().size());
    }


    // create a polygon with a whole in it
//    @Test
//    public void makePolygonOneHole() {
//        Polygon poly = FootprintExtruder.makePolygon(geomOneHole.getCoordinates()[0], 0);
//
//        assertEquals(outerRingExpected, ((LinearRing) poly.getExterior().getRing()).toList3d().toString());
//        assertEquals(1, poly.getInterior().size());
//        assertEquals(innerRing1Expected, ((LinearRing)poly.getInterior().get(0).getRing()).toList3d().toString());
//    }


    // create a polygon with 2 wholes in it


    // create a 3d solid
    @Test
    public void makeSolidNoHoles() {
        List<Polygon> surfaces = FootprintExtruder.extrudeBuilding(geomNoHoles, 3);

        assertEquals(6, surfaces.size());

        // floor
        Polygon floor = surfaces.get(0);
        assertEquals(outerRingExpected, ((LinearRing)floor.getExterior().getRing()).toList3d().toString());

        // roof
        Polygon roof = surfaces.get(surfaces.size()-1);
        System.out.println(((LinearRing)roof.getExterior().getRing()).toList3d().toString());
        assertEquals(roofOuterRingExpected, ((LinearRing)roof.getExterior().getRing()).toList3d().toString());

        // walls
        for ( int i=1; i < surfaces.size()-1; i++ ) {
            Polygon wall = surfaces.get(i);

            assertEquals(wallOuterRingExpected[i-1], ((LinearRing)wall.getExterior().getRing()).toList3d().toString());
        }
    }

    // create a 3d solid with a whole in it
    // create a 3d solid with 2 wholes in it


}