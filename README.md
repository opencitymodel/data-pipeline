# OCM Data Pipeline

This repository houses the various scripts and tools used produce the citygml files provided by Open City Model.  These scripts can all be run on any linux/unix computer with the right packages but in general they are designed to be run in AWS.

# Pipeline Steps

1. **Footprints** - scripts here are used to generate JSON based files containing the footprint geometries for all of the buildings along with additional attributes which we want about the buildings and can safely calculate right away.  we also use this step to organize the data into smaller files organized by MGRS grid.
2. **Building Heights** - here we use whatever data we can and build ML models where needed to find a height that we can associate with each building.  Currently this step is taking place in AWS via databricks but we plan to add that code here once things are better developed.  results of this step are JSON files with the same structure as the footprints output.
3. **Citygml** - last step of the pipeline is to read in the building JSON files, extrude the buildings into 3D shapes, and write out the final details into the citygml format.  Due to the size of citygml files we are producing the buildings by US County and capping them at roughly 40k buildings per file which tends to generate ~200MB files.
4. **Geocode** - scripts here are used to setup some very crude reverse geocoding data so that we can do things such as determine the US county a given footprint falls within.

# License

This code is released under the [MIT license](LICENSE.txt)
