# Open City Model - Data Pipeline

This repository houses the various scripts and tools used produce the citygml & cityjson files provided by Open City Model.  These scripts can all be run on any linux/unix computer with the right packages but in general they are designed to be run on AWS.

# Pipeline Components

1. **Data Preparation** - the files in the `data-prep` folder contain scripts which take raw data from various datasets and transforms them into a known and standardized format for further processing.  for the most part these scripts do things such as extract compressed files, transform ESRI shapefiles into our GeoJSON based footprints format, and unify units values and coordinate systems.
2. **Grid and Attributes** - in this step we take files which have been properly prepared and we do a pass over each footprint in order to A) add a set of common properties to the data such as `area`, `grid`, `ubid`, and a unique `hash`, and B) to group the footprints into smaller files based on the grid the footprint falls within.  these files are all maintained in the `grid-and-attrs` folder and the output format is a single GeoJSON feature per line.
3. **Footprint Reconciliation + Heights** - This component takes in all available footprint data and works to combine and resolve it down to a master set of building definitions.  We attempt to use known measured sources of data for building heights as much as possible but when that is not available we utilize machine learning models to estimate the height.  NOTE: Currently this step is taking place in AWS via databricks but we plan to add that code here once things are better developed.  results of this step are a flattened and simplified JSON structure with a single footprint per line.
4. **CityGML / CityJSON** - The final component of the pipeline is to read in the building JSON files, extrude the buildings into 3D shapes, and write out the final details into the desired format.  Due to the size of citygml files we are producing the buildings by US County and capping them at roughly 40k buildings per file which tends to generate ~200MB files.
5. **Geocode** - Code here is used to setup some basic reverse geocoding data so that we can do things such as determine the US county a given footprint falls within.

# Prepared Data Format

All footprints data that is ready to be processed should be placed in files that follow the following rules:
 - there should be a single file per US state which is named `<state>.txt`.  for example, `California.txt`
 - each line in the file should be a single JSON object.
 - the JSON object on each line should represent a single building footprint structured as a GeoJSON `geometry`.  NOTE: this is not a full GeoJSON document, just a single Feature.
 - the coordinates in the geometry of the footprint should be provided in WGS84 coordinate system.
 - the height of the building (if provided) should be in a GeoJSON property with key `height` and the value should be in meters.


# License

This code is released under the [MIT license](LICENSE.txt)
