package org.opencitymodel.citygml;

import static org.junit.Assert.*;
import org.junit.Test;


public class MainTest {

    private static final String testFile = "./src/test/buildings.json";

    @Test
    public void main() {
        System.out.println("Working Directory = " +
                System.getProperty("user.dir"));
        Main main = new Main("/tmp", "testgml", CitygmlBuilder.LOD1, CitygmlBuilder.CITYGML, 100, false);

        main.processFile(testFile);
    }
}