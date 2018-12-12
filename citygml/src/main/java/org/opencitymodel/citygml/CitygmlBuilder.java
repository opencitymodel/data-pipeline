package org.opencitymodel.citygml;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Base64;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.citygml4j.CityGMLContext;
import org.citygml4j.builder.jaxb.CityGMLBuilder;
import org.citygml4j.factory.GMLGeometryFactory;
import org.citygml4j.model.citygml.building.Building;
import org.citygml4j.model.citygml.core.CityModel;
import org.citygml4j.model.citygml.core.CityObjectMember;
import org.citygml4j.model.citygml.generics.DoubleAttribute;
import org.citygml4j.model.citygml.generics.StringAttribute;
import org.citygml4j.model.gml.feature.BoundingShape;
import org.citygml4j.model.gml.geometry.aggregates.MultiSurface;
import org.citygml4j.model.gml.geometry.aggregates.MultiSurfaceProperty;
import org.citygml4j.model.gml.geometry.complexes.CompositeSurface;
import org.citygml4j.model.gml.geometry.primitives.Polygon;
import org.citygml4j.model.gml.geometry.primitives.Solid;
import org.citygml4j.model.gml.geometry.primitives.SolidProperty;
import org.citygml4j.model.gml.geometry.primitives.SurfaceProperty;
import org.citygml4j.model.gml.measures.Length;
import org.citygml4j.model.module.citygml.CityGMLVersion;
import org.citygml4j.util.bbox.BoundingBoxOptions;
import org.citygml4j.xml.io.CityGMLOutputFactory;
import org.citygml4j.xml.io.writer.CityGMLWriter;
import org.cts.op.CoordinateOperation;


public final class CitygmlBuilder {

    public static final int LOD0 = 0;
    public static final int LOD1 = 1;

    // The CityGML LOD to target
    private final int LOD;

    // We use this to do the coordinate system transformation before writing out the final Citygml
    private final String sourceCrs = "EPSG:4326";
    private final String targetCrs = "EPSG:3857";
    private final CoordinateOperation crsTransform = GeoUtil.getTransform(sourceCrs, targetCrs);


    // The buildings we've collected for inclusion in our file
    private final List<BuildingDef> buildings = new ArrayList<>();

    private final GMLGeometryFactory geom = new GMLGeometryFactory();


    public CitygmlBuilder(int lod) {
        this.LOD = lod;
    }


    public int getLod() {
        return this.LOD;
    }

    public void addBuilding(BuildingDef bldg) {
        buildings.add(bldg);
    }

    public int getNumBuildings() {
        return this.buildings.size();
    }


    /**
     * Take the current set of buildings in the builder and write them out to a file.
     *
     * @param path Filesystem path where the citygml should be written.
     */
    public void writeFile(String path, String filename) throws Exception {

        CityModel cityModel = new CityModel();

        // add our collected buildings to our city model
        for( BuildingDef bldg : buildings ) {
            Building building = createBuilding(bldg);
            cityModel.addCityObjectMember(new CityObjectMember(building));
        }

        CityGMLContext ctx = CityGMLContext.getInstance();
        CityGMLBuilder builder = ctx.createCityGMLBuilder(getClass().getClassLoader());
        CityGMLOutputFactory out = builder.createCityGMLOutputFactory(CityGMLVersion.DEFAULT);

        // we want a Zip compressed output
        FileOutputStream fos = new FileOutputStream(path+"/"+filename+".zip");
        BufferedOutputStream bos = new BufferedOutputStream(fos);
        ZipOutputStream zos = new ZipOutputStream(bos);
        zos.putNextEntry(new ZipEntry(filename+".gml"));
        CityGMLWriter writer = out.createCityGMLWriter(zos, "UTF-8");

        // add 'boundedBy' element along with coordinate system
        BoundingShape bbox = cityModel.calcBoundedBy(BoundingBoxOptions.defaults());
        bbox.getEnvelope().setSrsName(this.targetCrs);
        cityModel.setBoundedBy(bbox);

        writer.setPrefixes(CityGMLVersion.DEFAULT);
        writer.setSchemaLocations(CityGMLVersion.DEFAULT);
        writer.setIndentString("  ");
        writer.write(cityModel);
        writer.close();
    }


    private Building createBuilding(BuildingDef bldg) {
        Building building = new Building();
        building.setId(Base64.getEncoder().withoutPadding().encodeToString(bldg.getId().getBytes()));

        // convert the coordinates of the footprint into our desired CRS
        Geometry geometry = bldg.getGeometry();
        double[][] transformedCoords = transformCoordinates(geometry.getCoordinates()[0]);
        geometry.getCoordinates()[0] = transformedCoords;

        // construct the building surface (depends on LOD)
        if (this.LOD == LOD0) {
            MultiSurfaceProperty surface = createLOD0Footprint(geometry);
            building.setLod0FootPrint(surface);
        } else {
            // default is LOD1
            SolidProperty solid = createLOD1Solid(geometry, bldg.getHeight());
            building.setLod1Solid(solid);
        }

        // set the height
        Length measuredHeight = new Length(bldg.getHeight());
        measuredHeight.setUom("urn:ogc:def:uom:UCUM::m");
        building.setMeasuredHeight(measuredHeight);

        // add custom attributes
        building.addGenericAttribute(new StringAttribute("ubid", bldg.getUbid()));
        building.addGenericAttribute(new StringAttribute("state", bldg.getState()));
        building.addGenericAttribute(new StringAttribute("county", bldg.getCounty()));
        building.addGenericAttribute(new DoubleAttribute("latitude", bldg.getLat()));
        building.addGenericAttribute(new DoubleAttribute("longitude", bldg.getLon()));
        building.addGenericAttribute(new StringAttribute("mgrs", bldg.getMgrs()));
        building.addGenericAttribute(new DoubleAttribute("area", bldg.getArea()));
        building.addGenericAttribute(new StringAttribute("height_source", bldg.getHeight_source()));
        building.addGenericAttribute(new StringAttribute("fp_source", bldg.getFp_source()));

        return building;
    }


    private double[][] transformCoordinates(double[][] coords) {
        try {
            double[][] newCoords = new double[coords.length][];
            for (int i=0; i < coords.length; i++) {
                double[] coord = {coords[i][0], coords[i][1]};
                newCoords[i] = crsTransform.transform(coord);
            }

            return newCoords;

        } catch(Exception ex) {
            return coords;
        }
    }


    /** Create an LOD0 footprint surface **/
    private MultiSurfaceProperty createLOD0Footprint(Geometry geometry) {
        try {
            // NOTE: this is only a 2 dimensional polygon, so our coordinates only need 2 values
            //       also, reminder that coordinates must be in the order of [longitude, latitude]
            Polygon polygon = geom.createLinearPolygon(geometry.getCoordinates()[0], 2);

            MultiSurface footprint = new MultiSurface();
            footprint.addSurfaceMember(new SurfaceProperty(polygon));

            return new MultiSurfaceProperty(footprint);
        } catch(Exception ex) {
            throw new RuntimeException("Invalid footprint geometry data", ex);
        }
    }


    /** Create an LOD1 building solid **/
    private SolidProperty createLOD1Solid(Geometry geometry, double height) {
        // extrude our footprint into a list of polygons making a 3D shape
        List<Polygon> surfaces = extrudeBuilding(geometry, height);

        List<SurfaceProperty> surfaceMembers = new ArrayList<>();
        for (Polygon surface : surfaces) {
            surfaceMembers.add(new SurfaceProperty(surface));
        }

        CompositeSurface compositeSurface = new CompositeSurface();
        compositeSurface.setSurfaceMember(surfaceMembers);
        Solid solid = new Solid();
        solid.setExterior(new SurfaceProperty(compositeSurface));

        return new SolidProperty(solid);
    }


    // NOTE: we expect each point in the footprint coordinates to be of the form [longitude, latitude]
    private List<Polygon> extrudeBuilding(Geometry geometry, double height) {
        List<Polygon> surfaces = new ArrayList<>();

        // floor
        surfaces.add(makePolygon(geometry.getCoordinates()[0], 0.0));

        // walls
        double[][] coords = geometry.getCoordinates()[0];
        for( int i=0; i < coords.length; i++ ) {
            // take current point and next point as the 2 wall vertices we want to extrude
            // if we are only the final point of our footprint then use the first vertex to make the final wall
            double[] ptA = coords[i];
            double[] ptB;
            if (i == coords.length - 1) {
                ptB = coords[0];
            } else {
                ptB = coords[i+1];
            }

            surfaces.add(makeWallPolygon(ptA, ptB, height));
        }

        // roof
        surfaces.add(makePolygon(geometry.getCoordinates()[0], height));

        return surfaces;
    }


    private Polygon makePolygon(double[][] points, double height) {
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


    private Polygon makeWallPolygon(double[] ptA, double[] ptB, double height) {
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
