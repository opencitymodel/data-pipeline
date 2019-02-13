package org.opencitymodel.citygml;


public class Geometry {

    private String type;
    private double[][][] coordinates;


    public Geometry () {}

    public Geometry (String t, double[][][] c) {
        type = t;
        coordinates = c;
    }


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
}