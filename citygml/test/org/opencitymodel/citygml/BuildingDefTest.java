package org.opencitymodel.citygml;

import com.google.gson.Gson;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BuildingDefTest {

    private final String bldg = "{'id':'18SUJ1809:-1839185934','ubid':'87C4WW82+VM-1-1-0-1','state':'DistrictofColumbia','county':'11001','center':'-77.098352,38.917231','mgrs':'18SUJ1809','grid':'18SUJ10','height':80.03472385702814,'fp':{'geometry':{'coordinates':[[[-77.098372,38.91724],[-77.098389,38.917266],[-77.098459,38.917237],[-77.098392,38.917139],[-77.098214,38.917213],[-77.098263,38.917285],[-77.098372,38.91724]]],'type':'Polygon'},'type':'Feature'}}";

    @Test
    void gsonUnmarshall() {
        Gson gson = new Gson();
        BuildingDef parsed = gson.fromJson(bldg, BuildingDef.class);

        assertEquals(parsed.getId(), "18SUJ1809:-1839185934");
        assertEquals(parsed.getHeight(), 80.03472385702814);

        assertEquals(parsed.getFp().getGeometry().getCoordinates()[0][0][0], -77.098372);
        assertEquals(parsed.getFp().getGeometry().getCoordinates()[0][0][1], 38.91724);
    }
}