package org.opencitymodel.citygml;

import com.google.gson.Gson;
import static org.junit.Assert.*;
import org.junit.Test;


public class CitygmlBuilderTest {

    private final String bldg = "{'id':'18SUJ1809:-1839185934','ubid':'87C4WW82+VM-1-1-0-1','state':'DistrictofColumbia','county':'11001','center':'-77.098352,38.917231','mgrs':'18SUJ1809','grid':'18SUJ10','height':80.03472385702814,'height_source':'measured','fp_source':'test','geometry':{'coordinates':[[[-77.098372,38.91724],[-77.098389,38.917266],[-77.098459,38.917237],[-77.098392,38.917139],[-77.098214,38.917213],[-77.098263,38.917285],[-77.098372,38.91724]]]}}";

    @Test
    public void writeCitygmlFile() throws Exception {
        Gson gson = new Gson();
        BuildingDef parsed = gson.fromJson(bldg, BuildingDef.class);

        CitygmlBuilder builder = new CitygmlBuilder(CitygmlBuilder.LOD1, CitygmlBuilder.CITYGML);
        builder.addBuilding(parsed);
        builder.writeFile("/tmp/", "abcd");

        // TODO: read in file and validate it
    }

}