package org.opencitymodel.citygml;


public class BuildingDef {
    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getUbid() {
        return ubid;
    }

    public void setUbid(String ubid) {
        this.ubid = ubid;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getCounty() {
        return county;
    }

    public void setCounty(String county) {
        this.county = county;
    }

    public String getGrid() {
        return grid;
    }

    public void setGrid(String grid) {
        this.grid = grid;
    }

    public double getLat() {
        return lat;
    }

    public void setLat(double lat) {
        this.lat = lat;
    }

    public double getLon() {
        return lon;
    }

    public void setLon(double lon) {
        this.lon = lon;
    }

    public double getArea() {
        return area;
    }

    public void setArea(double area) {
        this.area = area;
    }

    public double getHeight() {
        return height;
    }

    public void setHeight(double height) {
        this.height = height;
    }

    public String getHeight_source() {
        return height_source;
    }

    public void setHeight_source(String height_source) {
        this.height_source = height_source;
    }

    public String getFp_source() {
        return fp_source;
    }

    public void setFp_source(String fp_source) {
        this.fp_source = fp_source;
    }

    public Geometry getGeometry() {
        return geometry;
    }

    public void setGeometry(Geometry geometry) {
        this.geometry = geometry;
    }

    private String hash;
    private String ubid;
    private String state;
    private String county;
    private String grid;
    private double lat;
    private double lon;
    private double area;
    private double height;
    private String height_source;
    private String fp_source;
    private Geometry geometry;
}
