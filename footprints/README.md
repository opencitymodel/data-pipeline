# Footprints Processing

1. **Data Preparation** - the files in the `data-prep` folder contain scripts which take raw data from various datasets and transforms them into a known and standardized format for further processing.  for the most part these scripts do things such as extract compressed files and then transform ESRI shapefiles into our GeoJSON based footprints format.
2. **Grid and Attributes** - in this step we take files which have been properly prepared and we do a pass over each footprint in order to A) add a set of common attributes to the data such as `center`, `mgrs`, and `ubid`, and B) to group the footprints into smaller files based on the 1km MGRS grid the footprint falls within.


# Prepared Data Format

All footprints data that is ready to be processed should be placed in files that follow the following rules:
 - there should be a single file per US state which is named `<state>.txt`.  for example, California.txt
 - each line in the file should be a single JSON object.  no extra line breaks or other formatting should be present.
 - the JSON object on each line should represent a single building footprint structured as a GeoJSON `geometry`.  NOTE: this is not a full GeoJSON document and only a geometry.
 - the coordinates in the geometry of the footprint should be provided in WGS84 coordinate system.
