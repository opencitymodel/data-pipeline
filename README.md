# OCM Data Pipeline

This repository houses the various scripts and tools used produce the citygml files provided by Open City Model.  These scripts can all be run on any linux/unix computer with the right packages but in general they are designed to be run in AWS.

# Pipeline Steps

1. Footprints - scripts here are used to generate JSON based files containing the footprint geometries for all of the buildings along with additional attributes which we want about the buildings and can safely calculate right away.  we also use this step to organize the data into smaller files organized by MGRS grid.
2. Building Heights - here we use whatever data we can and build ML models where needed to find a height that we can associate with each building.  most of the interesting magic happens here.  results of this step are still JSON files.
3. Citygml - last step of the pipeline is to read in the building JSON files, extrude the buildings into 3D shapes, and write out the final details into the citygml format.  Due to the size of citygml files we are producing the buildings by US County and capping them at roughly 40k buildings per file which tends to generate ~200MB files.

# License

This code is released under the [MIT license](LICENSE.txt)
