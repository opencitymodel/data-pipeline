package org.opencitymodel.citygml;

import org.citygml4j.model.gml.geometry.primitives.LinearRing;
import org.citygml4j.model.gml.geometry.primitives.Polygon;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;


public class FootprintExtruderTest {

    private double[][] outerRing = {{0,0}, {50,0}, {50,50}, {0,50}, {0,0}};
    private String outerRingExpected = "[0.0, 0.0, 0.0, 50.0, 0.0, 0.0, 50.0, 50.0, 0.0, 0.0, 50.0, 0.0, 0.0, 0.0, 0.0]";

    private double[][] innerRing1 = {{10,10}, {20,10}, {20,20}, {10,20}, {10,10}};
    private String innerRing1Expected = "[10.0, 10.0, 0.0, 20.0, 10.0, 0.0, 20.0, 20.0, 0.0, 10.0, 20.0, 0.0, 10.0, 10.0, 0.0]";

    private double[][] innerRing2 = {{30,30}, {40,30}, {40,40}, {30,40}, {30,30}};
    private String innerRing2Expected = "[30.0, 30.0, 0.0, 40.0, 30.0, 0.0, 40.0, 40.0, 0.0, 30.0, 40.0, 0.0, 30.0, 30.0, 0.0]";

    private double[][][] coordsNoHoles = {outerRing};
    private double[][][] coordsOneHole = {outerRing, innerRing1};
    private double[][][] coordsTwoHoles = {outerRing, innerRing1, innerRing2};

    private final Geometry geomNoHoles = new Geometry("Polygon", coordsNoHoles);
    private final Geometry geomOneHole = new Geometry("Polygon", coordsOneHole);
    private final Geometry geomTwoHoles = new Geometry("Polygon", coordsTwoHoles);

    // position lists for walls 3d solid
    private String[] wallRingExpected = {
            // these first 4 represent the outer walls
            "[0.0, 0.0, 0.0, 0.0, 0.0, 3.0, 50.0, 0.0, 3.0, 50.0, 0.0, 0.0, 0.0, 0.0, 0.0]",
            "[50.0, 0.0, 0.0, 50.0, 0.0, 3.0, 50.0, 50.0, 3.0, 50.0, 50.0, 0.0, 50.0, 0.0, 0.0]",
            "[50.0, 50.0, 0.0, 50.0, 50.0, 3.0, 0.0, 50.0, 3.0, 0.0, 50.0, 0.0, 50.0, 50.0, 0.0]",
            "[0.0, 50.0, 0.0, 0.0, 50.0, 3.0, 0.0, 0.0, 3.0, 0.0, 0.0, 0.0, 0.0, 50.0, 0.0]",

            // these next 4 represent inner ring 1
            "[10.0, 10.0, 0.0, 10.0, 10.0, 3.0, 20.0, 10.0, 3.0, 20.0, 10.0, 0.0, 10.0, 10.0, 0.0]",
            "[20.0, 10.0, 0.0, 20.0, 10.0, 3.0, 20.0, 20.0, 3.0, 20.0, 20.0, 0.0, 20.0, 10.0, 0.0]",
            "[20.0, 20.0, 0.0, 20.0, 20.0, 3.0, 10.0, 20.0, 3.0, 10.0, 20.0, 0.0, 20.0, 20.0, 0.0]",
            "[10.0, 20.0, 0.0, 10.0, 20.0, 3.0, 10.0, 10.0, 3.0, 10.0, 10.0, 0.0, 10.0, 20.0, 0.0]",

            // these last 4 represent inner ring 2
            "[30.0, 30.0, 0.0, 30.0, 30.0, 3.0, 40.0, 30.0, 3.0, 40.0, 30.0, 0.0, 30.0, 30.0, 0.0]",
            "[40.0, 30.0, 0.0, 40.0, 30.0, 3.0, 40.0, 40.0, 3.0, 40.0, 40.0, 0.0, 40.0, 30.0, 0.0]",
            "[40.0, 40.0, 0.0, 40.0, 40.0, 3.0, 30.0, 40.0, 3.0, 30.0, 40.0, 0.0, 40.0, 40.0, 0.0]",
            "[30.0, 40.0, 0.0, 30.0, 40.0, 3.0, 30.0, 30.0, 3.0, 30.0, 30.0, 0.0, 30.0, 40.0, 0.0]"
    };

    // position lists for roofs of 3d solid -- remember, this should be reversed from the original footprint
    private String roofOuterRingExpected = "[0.0, 0.0, 3.0, 0.0, 50.0, 3.0, 50.0, 50.0, 3.0, 50.0, 0.0, 3.0, 0.0, 0.0, 3.0]";
    private String roofInnerRing1Expected = "[10.0, 10.0, 3.0, 10.0, 20.0, 3.0, 20.0, 20.0, 3.0, 20.0, 10.0, 3.0, 10.0, 10.0, 3.0]";
    private String roofInnerRing2Expected = "[30.0, 30.0, 3.0, 30.0, 40.0, 3.0, 40.0, 40.0, 3.0, 40.0, 30.0, 3.0, 30.0, 30.0, 3.0]";


    // create a simple polygon
    @Test
    public void makePolygonNoHoles() {
        Polygon poly = FootprintExtruder.makePolygon(geomNoHoles.getCoordinates(), 0);

        assertEquals(outerRingExpected, ((LinearRing) poly.getExterior().getRing()).toList3d().toString());
        assertEquals(0, poly.getInterior().size());
    }


    // create a polygon with a whole in it
    @Test
    public void makePolygonOneHole() {
        Polygon poly = FootprintExtruder.makePolygon(geomOneHole.getCoordinates(), 0);

        assertEquals(outerRingExpected, ((LinearRing) poly.getExterior().getRing()).toList3d().toString());
        assertEquals(1, poly.getInterior().size());
        assertEquals(innerRing1Expected, ((LinearRing)poly.getInterior().get(0).getRing()).toList3d().toString());
    }


    // create a polygon with 2 wholes in it
    @Test
    public void makePolygonTwoHoles() {
        Polygon poly = FootprintExtruder.makePolygon(geomTwoHoles.getCoordinates(), 0);

        assertEquals(outerRingExpected, ((LinearRing) poly.getExterior().getRing()).toList3d().toString());
        assertEquals(2, poly.getInterior().size());
        assertEquals(innerRing1Expected, ((LinearRing)poly.getInterior().get(0).getRing()).toList3d().toString());
        assertEquals(innerRing2Expected, ((LinearRing)poly.getInterior().get(1).getRing()).toList3d().toString());
    }

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
        assertEquals(roofOuterRingExpected, ((LinearRing)roof.getExterior().getRing()).toList3d().toString());

        // walls
        for ( int i=1; i < surfaces.size()-1; i++ ) {
            Polygon wall = surfaces.get(i);

            assertEquals(wallRingExpected[i-1], ((LinearRing)wall.getExterior().getRing()).toList3d().toString());
        }
    }

    // create a 3d solid with a whole in it
    @Test
    public void makeSolidOneHole() {
        List<Polygon> surfaces = FootprintExtruder.extrudeBuilding(geomOneHole, 3);

        assertEquals(10, surfaces.size());

        // floor
        Polygon floor = surfaces.get(0);
        assertEquals(outerRingExpected, ((LinearRing)floor.getExterior().getRing()).toList3d().toString());
        assertEquals(1, floor.getInterior().size());
        assertEquals(innerRing1Expected, ((LinearRing)floor.getInterior().get(0).getRing()).toList3d().toString());

        // roof
        Polygon roof = surfaces.get(surfaces.size()-1);
        assertEquals(roofOuterRingExpected, ((LinearRing)roof.getExterior().getRing()).toList3d().toString());
        assertEquals(1, roof.getInterior().size());
        assertEquals(roofInnerRing1Expected, ((LinearRing)roof.getInterior().get(0).getRing()).toList3d().toString());

        // walls
        for ( int i=1; i < surfaces.size()-1; i++ ) {
            Polygon wall = surfaces.get(i);

            assertEquals(wallRingExpected[i-1], ((LinearRing)wall.getExterior().getRing()).toList3d().toString());
        }
    }

    // create a 3d solid with 2 wholes in it
    @Test
    public void makeSolidTwoHoles() {
        List<Polygon> surfaces = FootprintExtruder.extrudeBuilding(geomTwoHoles, 3);

        assertEquals(14, surfaces.size());

        // floor
        Polygon floor = surfaces.get(0);
        assertEquals(outerRingExpected, ((LinearRing)floor.getExterior().getRing()).toList3d().toString());
        assertEquals(2, floor.getInterior().size());
        assertEquals(innerRing1Expected, ((LinearRing)floor.getInterior().get(0).getRing()).toList3d().toString());
        assertEquals(innerRing2Expected, ((LinearRing)floor.getInterior().get(1).getRing()).toList3d().toString());

        // roof
        Polygon roof = surfaces.get(surfaces.size()-1);
        assertEquals(roofOuterRingExpected, ((LinearRing)roof.getExterior().getRing()).toList3d().toString());
        assertEquals(2, roof.getInterior().size());
        assertEquals(roofInnerRing1Expected, ((LinearRing)roof.getInterior().get(0).getRing()).toList3d().toString());
        assertEquals(roofInnerRing2Expected, ((LinearRing)roof.getInterior().get(1).getRing()).toList3d().toString());

        // walls
        for ( int i=1; i < surfaces.size()-1; i++ ) {
            Polygon wall = surfaces.get(i);

            assertEquals(wallRingExpected[i-1], ((LinearRing)wall.getExterior().getRing()).toList3d().toString());
        }
    }

}