package org.opencitymodel.citygml;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MainTest {

    private static final String testFile = "/Users/agilliland/Downloads/part-00002-tid-2490189040967298898-edd42661-71fc-4d5f-8a68-c9f62c0738f4-629.c000.json";

    @Test
    void main() {
        Main main = new Main("/tmp", "testgml", CitygmlBuilder.LOD1, 100);

        main.processFile(testFile);
    }
}