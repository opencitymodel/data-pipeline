package org.opencitymodel.citygml;

import org.opencitymodel.citygml.GeoJSON;


public class BuildingDef {
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public String getMgrs() {
        return mgrs;
    }

    public void setMgrs(String mgrs) {
        this.mgrs = mgrs;
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

    public GeoJSON getFp() {
        return fp;
    }

    public void setFp(GeoJSON fp) {
        this.fp = fp;
    }

    private String id;
    private String ubid;
    private String state;
    private String county;
    private String mgrs;
    private String grid;
    private double lat;
    private double lon;
    private double area;

    private double height;
    private GeoJSON fp;
}
