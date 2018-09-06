package org.opencitymodel.citygml;


class Geometry {
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double[][][] getCoordinates() {
        return coordinates;
    }

    public void setCoordinates(double[][][] coordinates) {
        this.coordinates = coordinates;
    }

    private String type;
    private double[][][] coordinates;
}


public class GeoJSON {
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Geometry getGeometry() {
        return geometry;
    }

    public void setGeometry(Geometry geometry) {
        this.geometry = geometry;
    }

    private String type;
    private Geometry geometry;
}
