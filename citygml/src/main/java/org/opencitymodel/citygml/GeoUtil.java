package org.opencitymodel.citygml;

import org.cts.CRSFactory;
import org.cts.crs.GeodeticCRS;
import org.cts.op.CoordinateOperation;
import org.cts.op.CoordinateOperationFactory;
import org.cts.registry.EPSGRegistry;
import org.cts.registry.RegistryManager;
import java.util.Set;


public class GeoUtil {

    private static final CRSFactory crsFactory;
    private static final RegistryManager rm;

    static {
        crsFactory = new CRSFactory();
        rm = crsFactory.getRegistryManager();
        rm.addRegistry(new EPSGRegistry());
    }


    public static CoordinateOperation getTransform(String srcCrs, String targetCrs) {
        try {
            GeodeticCRS sourceCRS = (GeodeticCRS) crsFactory.getCRS(srcCrs);
            GeodeticCRS targetCRS = (GeodeticCRS) crsFactory.getCRS(targetCrs);

            Set<CoordinateOperation> transforms = CoordinateOperationFactory.createCoordinateOperations(sourceCRS, targetCRS);
            return transforms.iterator().next();

        } catch(Exception ex) {
            ex.printStackTrace();
            return null;
        }
    }
}
