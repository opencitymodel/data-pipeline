package org.opencitymodel.citygml;

import com.google.gson.Gson;
import static org.junit.Assert.*;
import org.junit.Test;


public class BuildingDefTest {

    private final String bldg = "{'hash':'ABCD123','ubid':'87C4WW82+VM-1-1-0-1','state':'DistrictofColumbia','county':'11001','center':'-77.098352,38.917231','grid':'18SUJ10','height':80.03472385702814,'height_source':'measured','fp_source':'test','geometry':{'coordinates':[[[-77.098372,38.91724],[-77.098389,38.917266],[-77.098459,38.917237],[-77.098392,38.917139],[-77.098214,38.917213],[-77.098263,38.917285],[-77.098372,38.91724]]]}}";

    @Test
    public void gsonUnmarshall() {
        Gson gson = new Gson();
        BuildingDef parsed = gson.fromJson(bldg, BuildingDef.class);

        assertEquals("ABCD123", parsed.getHash());
        assertEquals(80.03472385702814, parsed.getHeight(), 0.00001);
        assertEquals("measured", parsed.getHeight_source());
        assertEquals("test", parsed.getFp_source());
        assertEquals("18SUJ10", parsed.getGrid());

        assertEquals(-77.098372, parsed.getGeometry().getCoordinates()[0][0][0], 0);
        assertEquals(38.91724, parsed.getGeometry().getCoordinates()[0][0][1], 0);
    }
}