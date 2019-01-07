# Open City Model - Data Pipeline

This repository houses the various scripts and tools used produce the citygml & cityjson files provided by Open City Model.  These scripts can all be run on any linux/unix computer with the right packages but in general they are designed to be run on AWS.

# Pipeline Components

1. **Footprints** - Here we start by gathering and preparing all data sources utilized as part of OCM.  The goal of this component is to generate JSON based files (for each distinct data source) containing a) the footprint geometries, b) additional attributes we want about the footprints, and c) data split & organized into distinct files per 1km MGRS grid.
2. **Buildings+Heights** - This component takes in all available footprint data and works to combine and resolve it down to a master set of building definitions.  We attempt to use known measured sources of data for building heights but when that is not available we utilize machine learning models to estimate the height.  NOTE: Currently this step is taking place in AWS via databricks but we plan to add that code here once things are better developed.  results of this step are JSON files with the same structure as the footprints output.
3. **Citygml/cityjson** - The final component of the pipeline is to read in the building JSON files, extrude the buildings into 3D shapes, and write out the final details into the desired format.  Due to the size of citygml files we are producing the buildings by US County and capping them at roughly 40k buildings per file which tends to generate ~200MB files.
4. **Geocode** - Code here is used to setup some basic reverse geocoding data so that we can do things such as determine the US county a given footprint falls within.

# License

This code is released under the [MIT license](LICENSE.txt)
