package org.opencitymodel.citygml;

import com.google.gson.Gson;
import static org.junit.Assert.*;
import org.junit.Test;


public class BuildingDefTest {

    private final String bldg = "{'id':'18SUJ1809:-1839185934','ubid':'87C4WW82+VM-1-1-0-1','state':'DistrictofColumbia','county':'11001','center':'-77.098352,38.917231','mgrs':'18SUJ1809','grid':'18SUJ10','height':80.03472385702814,'height_source':'measured','geometry':{'coordinates':[[[-77.098372,38.91724],[-77.098389,38.917266],[-77.098459,38.917237],[-77.098392,38.917139],[-77.098214,38.917213],[-77.098263,38.917285],[-77.098372,38.91724]]]}}";

    @Test
    public void gsonUnmarshall() {
        Gson gson = new Gson();
        BuildingDef parsed = gson.fromJson(bldg, BuildingDef.class);

        assertEquals("18SUJ1809:-1839185934", parsed.getId());
        assertEquals(80.03472385702814, parsed.getHeight(), 0.00001);
        assertEquals("measured", parsed.getHeight_source());

        assertEquals(-77.098372, parsed.getGeometry().getCoordinates()[0][0][0], 0);
        assertEquals(38.91724, parsed.getGeometry().getCoordinates()[0][0][1], 0);
    }
}