# Footprints Processing





# Prepared Data Format

All footprints data that is ready to be processed should be placed in files that follow the following rules:
 - there should be a single file per US state which is named `<state>.txt`.  for example, California.txt
 - each line in the file should be a single JSON object.  no extra line breaks or other formatting should be present.
 - the JSON object on each line should represent a single building footprint structured as a GeoJSON `geometry`.  NOTE: this is not a full GeoJSON document, just a single Feature.
 - the coordinates in the geometry of the footprint should be provided in WGS84 coordinate system.
