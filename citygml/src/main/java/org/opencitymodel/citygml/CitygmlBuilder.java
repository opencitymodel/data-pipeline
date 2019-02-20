package org.opencitymodel.citygml;

import java.io.BufferedOutputStream;
import java.io.FileOutputStream;
import java.util.Base64;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.util.ArrayList;
import java.util.List;

import org.citygml4j.CityGMLContext;
import org.citygml4j.binding.cityjson.feature.CRSType;
import org.citygml4j.binding.cityjson.feature.MetadataType;
import org.citygml4j.builder.cityjson.CityJSONBuilder;
import org.citygml4j.builder.cityjson.json.io.writer.CityJSONOutputFactory;
import org.citygml4j.builder.cityjson.json.io.writer.CityJSONWriter;
import org.citygml4j.builder.cityjson.marshal.util.DefaultVerticesBuilder;
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


public final class CitygmlBuilder {

    public static final int LOD0 = 0;
    public static final int LOD1 = 1;

    public static final String CITYGML = "gml";
    public static final String CITYJSON = "json";

    // The CityGML LOD to target
    private final int LOD;

    // The data format we are writing.  CityGML or CityJSON
    private final String FORMAT;


    // The buildings we've collected for inclusion in our file
    private final List<BuildingDef> buildings = new ArrayList<>();

    private final GMLGeometryFactory geom = new GMLGeometryFactory();


    public CitygmlBuilder(int lod, String format) {
        this.LOD = lod;
        this.FORMAT = format;
    }


    public int getLod() {
        return this.LOD;
    }

    public String getFormat() {
        return this.FORMAT;
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

        // add metadata, including bounding box and coordinate system
        BoundingShape bbox = cityModel.calcBoundedBy(BoundingBoxOptions.defaults());
        // NOTE: 4979 is a 3D CRS that uses lat,lon in degrees, and height in meters
        bbox.getEnvelope().setSrsName("EPSG:4979");
        cityModel.setBoundedBy(bbox);

        if ( FORMAT.equals(CITYJSON) ) {
            // Writing CityJSON
            CityGMLContext ctx = CityGMLContext.getInstance();
            CityJSONBuilder builder = ctx.createCityJSONBuilder();
            CityJSONOutputFactory factory = builder.createCityJSONOutputFactory();
            factory.setVerticesBuilder(new DefaultVerticesBuilder().withSignificantDigits(6));

            // simple file output
            FileOutputStream fos = new FileOutputStream(path+"/"+filename+".json");
            BufferedOutputStream bos = new BufferedOutputStream(fos);
            CityJSONWriter writer = factory.createCityJSONWriter(bos);

            // add metadata
            MetadataType metadata = new MetadataType();
            CRSType epsg4979 = new CRSType();
            epsg4979.setEpsg(4979);
            metadata.setCRS(epsg4979);
            writer.setMetadata(metadata);

            // write out the model
            writer.write(cityModel);
            writer.close();

        } else {
            // Writing CityGML
            CityGMLContext ctx = CityGMLContext.getInstance();
            CityGMLBuilder builder = ctx.createCityGMLBuilder(getClass().getClassLoader());
            CityGMLOutputFactory factory = builder.createCityGMLOutputFactory(CityGMLVersion.DEFAULT);

            // we want a Zip compressed output
            FileOutputStream fos = new FileOutputStream(path+"/"+filename+".zip");
            BufferedOutputStream bos = new BufferedOutputStream(fos);
            ZipOutputStream zos = new ZipOutputStream(bos);
            zos.putNextEntry(new ZipEntry(filename+".gml"));
            CityGMLWriter writer = factory.createCityGMLWriter(zos, "UTF-8");

            // write out the model
            writer.setPrefixes(CityGMLVersion.DEFAULT);
            writer.setSchemaLocations(CityGMLVersion.DEFAULT);
            writer.setIndentString("  ");
            writer.write(cityModel);
            writer.close();
        }
    }


    private Building createBuilding(BuildingDef bldg) {
        Building building = new Building();
        building.setId(Base64.getEncoder().withoutPadding().encodeToString(bldg.getId().getBytes()));

        // construct the building surface (depends on LOD)
        if (this.LOD == LOD0) {
            MultiSurfaceProperty surface = createLOD0Footprint(bldg.getGeometry());
            building.setLod0FootPrint(surface);
        } else {
            // default is LOD1
            SolidProperty solid = createLOD1Solid(bldg.getGeometry(), bldg.getHeight());
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
        // this converts the height from meters to degrees (if you wanted to do that)
        //height = height/111139.0;

        // extrude our footprint into a list of polygons making a 3D shape
        List<Polygon> surfaces = FootprintExtruder.extrudeBuilding(geometry, height);

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

}
