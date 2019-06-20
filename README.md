# Open City Model - Data Pipeline

This repository houses the various scripts and tools used produce the citygml & cityjson files provided by Open City Model.  These scripts can all be run on any linux/unix computer with the right packages but in general they are designed to be run on AWS.

# Pipeline Components

- **citygml** - Reads in the building JSON files after `footprint-res`, extrudes the buildings into 3D shapes, and writes out the final details into the desired format.  Due to the size of citygml files we are partitioning the buildings by US County and capping them at roughly 40k buildings per file which tends to generate ~200MB files.

- **data-prep** - Scripts which take raw data from various source datasets and transforms them into a known and standardized format for further processing.  for the most part these scripts do things such as extract compressed files, transform ESRI shapefiles into our GeoJSON based footprints format, unify units values, and transform coordinate systems.  The output format is a single GeoJSON feature per line.

-  **footprint-res** - This component takes in all available footprint data and works to combine and resolve it down to a master set of building definitions.  We attempt to use known measured sources of data for building heights as much as possible but when that is not available we utilize machine learning models to estimate the height.  Output of this step are a flattened and simplified JSON structure with a single footprint per line.

- **grid-and-attrs** - Takes files which have been properly prepared via `data-prep` and does a pass over each footprint in order to add a set of common properties to the data such as `area`, `grid`, `ubid`, `hash`, etc.  The output format is a single GeoJSON feature per line.

# Prepared Data Format

All footprints data that is ready to be processed should be placed in files that follow the following rules:
 - there should be a single file per US state which is named `<state>.txt`.  for example, `California.txt`
 - each line in the file should be a single JSON object.
 - the JSON object on each line should represent a single building footprint structured as a GeoJSON `geometry`.  NOTE: this is not a full GeoJSON document, just a single Feature.
 - the coordinates in the geometry of the footprint should be provided in WGS84 coordinate system.
 - the height of the building (if provided) should be in a GeoJSON property with key `height` and the value should be in meters.


# License

This code is released under the [MIT license](LICENSE.txt)
