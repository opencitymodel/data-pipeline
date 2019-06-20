// Databricks notebook source
// DBTITLE 1,Initialization
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

val usState:String = dbutils.widgets.get("state")
val version:String = dbutils.widgets.get("version")
val outfolder = "/mnt/ocm-buildings/version="+version+"/state="+usState

// COMMAND ----------

// DBTITLE 1,Setup
// determine which datasources actually have data for our state
val dataSources = Array("LARIAC4-2014", "msfp-2017", "osm", "msfp-usbuildings-v1-1")
val footprintSources = dataSources.filter(ds => {
  dbutils.fs.ls("/mnt/ocm-footprints/datasource="+ds).map(fi => fi.name).contains("state="+usState+"/")
})

// COMMAND ----------

// DBTITLE 1,Load the Model
// load the model
import org.apache.spark.ml.PipelineModel
val loadedModel = PipelineModel.load("/models/building_height/osm_randomforest_v_0_1")

// COMMAND ----------

// DBTITLE 1,Define useful functions
import geotrellis.vector._
import geotrellis.vector.io._
import geotrellis.vector.io.json._

// predicate function testing if 2 polygons overlap
// polygons are expected to be GeoJSON geometries of type Polygon as a string of JSON
val polygonIntersect = udf((src:String, comp:String) => {
  if (src == null || comp == null) {
    false
  } else {
    src.parseGeoJson[Polygon] intersects comp.parseGeoJson[Polygon]
  }
})


// distance between 2 lat/lon pairs on the globe
val haversine = udf((src_lat:Double, src_lon:Double, dest_lat:Double, dest_lon:Double) => {
  val a = scala.math.pow(scala.math.sin(scala.math.toRadians(dest_lat - src_lat) / 2), 2) + scala.math.cos(scala.math.toRadians(src_lat)) * scala.math.cos(scala.math.toRadians(dest_lat)) * scala.math.pow(scala.math.sin(scala.math.toRadians(dest_lon - src_lon) / 2), 2)
  
  scala.math.atan2(scala.math.sqrt(a), scala.math.sqrt(-a + 1)) * 2 * 6371 * 1000 // last bit is km -> m
})


import com.google.openlocationcode.OpenLocationCode;

val openloc = udf((lat:Double, lon:Double) => {
  // depending on the area of the building pick an appropriate precision??
  OpenLocationCode.encode(lat, lon, 8)
})

val openlocAlt = udf((lat:Double, latDelta:Double, lon:Double, lonDelta:Double) => {
  // depending on the area of the building pick an appropriate precision??
  
  val movedLat = lat + latDelta
  val movedLon = lon + lonDelta
  
  val altLat = if (movedLat > 90) 90 else movedLat
  val altLon = if (movedLon > 180) movedLon - 180 else movedLon
  
  OpenLocationCode.encode(altLat, altLon, 8)
})

// COMMAND ----------

// DBTITLE 1,Read in Footprints
import scala.util.{Try,Success,Failure}

val footprints = for(fs <- footprintSources) yield {
  val data = spark.read.json("/mnt/ocm-footprints/datasource="+fs+"/state="+usState+"/*.txt")
    
  // expect input to be a GeoJSON feature object with keys: type:Str, geometry:Obj, properties:Obj
  
  // normalize columns to a specific set of things we care about
  // NOTE: this is important because it creates a uniform DF which we can safely merge across footprint sets
  val normalized = data
    .withColumn("providedHeight", if (Try(data("properties.height")).isSuccess) $"properties.height" else lit(null))
    .select(
      $"geometry",
      $"properties.hash",
      $"properties.ubid",
      $"properties.state",
      $"properties.county",
      $"properties.grid",
      $"properties.lat",
      $"properties.lon",
      $"properties.area",
      $"providedHeight")
    .dropDuplicates("hash")
    
  // create a height prediction and resolve our best option for the height property of the building
  loadedModel.transform(normalized)
    .withColumn("height", when($"providedHeight".isNotNull, $"providedHeight").otherwise(round($"prediction", 2)).cast(DoubleType))
    .withColumn("height_source", when($"providedHeight".isNotNull, lit(fs)).otherwise(lit("model")))
    .withColumn("height_predict", round($"prediction", 2))
    .withColumn("fp_source", lit(fs))
    .withColumn("openlocA", substring($"ubid", 0, 8))
    // move the center north and east by exactly 1/2 of an 8 digit grid (1/400 of a degree)
    .withColumn("openlocB", openlocAlt($"lat", lit(0.00125), $"lon", lit(0.00125)))
    // move the center north only
    .withColumn("openlocC", openlocAlt($"lat", lit(0.00125), $"lon", lit(0)))
    // move the center east only
    .withColumn("openlocD", openlocAlt($"lat", lit(0), $"lon", lit(0.00125)))
    .drop("providedHeight", "features", "prediction")
    .filter($"height" > lit(0))
    .filter($"height" < lit(550))
    .filter($"county".isNotNull)
    .cache
}

// COMMAND ----------

// DBTITLE 1,Merge footprint sets together
val finalFootprints = footprints.reduce((masterFps, incomingFps) => {
  
  // filter which tests if two paired buildings are over a given distance apart (5x the "radius" of the incoming building)
  // NOTE: if this filter is too tight, e.g. the allowed distance is too short, then we'll end up with overlapping buildings in our results
  //       but by using this filter we reduce the number of polygon intersections we need to test and speed up our processing
  val distCond = haversine($"_1.lat", $"_1.lon", $"_2.lat", $"_1.lon") < (sqrt($"_1.area") * lit(5.0))
  
  // why pair buildings 4 times?
  // we do the pairing work 4 times in order to cover all possible variations of pairs.  when starting with a single grid
  // you will pair up most buildings as desired, but each of the 4 edges of the grid represents an opportunity to miss a 
  // pairing between two buildings which are actually close together.  by running the pairing logic using 4 different and
  // slightly overlapping grids we ensure that all possible pairs are created.
  
  // normal grid
  val pairsA = incomingFps
                .joinWith(masterFps, masterFps("openlocA") === incomingFps("openlocA"), "outer")
                .filter(distCond) // remove building pairs which are likely too far away
                .withColumn("incomingPoly", to_json($"_1.geometry"))
                .withColumn("incomingId", $"_1.hash")
                .withColumn("srcPoly", to_json($"_2.geometry"))
                .withColumn("uniqId", concat($"_2.hash", $"_1.hash"))
  
  // shift grid NORTH & EAST 1/2 grid
  val pairsB = incomingFps
                .joinWith(masterFps, masterFps("openlocB") === incomingFps("openlocB"), "outer")
                .filter(distCond) // remove building pairs which are likely too far away
                .withColumn("incomingPoly", to_json($"_1.geometry"))
                .withColumn("incomingId", $"_1.hash")
                .withColumn("srcPoly", to_json($"_2.geometry"))
                .withColumn("uniqId", concat($"_2.hash", $"_1.hash"))
  
  // shift grid NORTH 1/2 grid
  val pairsC = incomingFps
                .joinWith(masterFps, masterFps("openlocC") === incomingFps("openlocD"), "outer")
                .filter(distCond) // remove building pairs which are likely too far away
                .withColumn("incomingPoly", to_json($"_1.geometry"))
                .withColumn("incomingId", $"_1.hash")
                .withColumn("srcPoly", to_json($"_2.geometry"))
                .withColumn("uniqId", concat($"_2.hash", $"_1.hash"))
  
  // shift grid EAST 1/2 grid
  val pairsD = incomingFps
                .joinWith(masterFps, masterFps("openlocD") === incomingFps("openlocD"), "outer")
                .filter(distCond) // remove building pairs which are likely too far away
                .withColumn("incomingPoly", to_json($"_1.geometry"))
                .withColumn("incomingId", $"_1.hash")
                .withColumn("srcPoly", to_json($"_2.geometry"))
                .withColumn("uniqId", concat($"_2.hash", $"_1.hash"))
  
  // now union and distinct the sets of pairs to come out with a final master set
  val pairs = pairsA.union(pairsB).union(pairsC).union(pairsD).dropDuplicates("uniqId")
  
  // find incoming buildings (id only) which collide with one of the source buildings
  val incoming_collisions = pairs
                              .filter(polygonIntersect($"incomingPoly", $"srcPoly"))
                              .select($"incomingId")
                              .distinct()

  // extract out just the incoming buildings which did NOT collide with anything
  val incoming_additions = incomingFps
                            .join(incoming_collisions, incomingFps("hash") === incoming_collisions("incomingId"), "left")
                            .filter($"incomingId".isNull)
                            .select(incomingFps("*"))
    
  // union the additions onto the master
  masterFps.union(incoming_additions)
  
}).cache

// COMMAND ----------

// DBTITLE 1,Prep the final DF for output
// the final dataset we will be writing into our json files for citygml construction
// NOTE: "cty" columns are just used for partitioning the data as its written out
val prepped_buildings = finalFootprints.
      select($"hash", $"ubid", $"state", $"county", $"grid", $"lat", $"lon", $"area", $"height", $"height_source", $"height_predict", $"fp_source", $"geometry", $"county".as("cty")).cache

// COMMAND ----------

// DBTITLE 1,Write out the results
// make our output folder
dbutils.fs.mkdirs(outfolder)

prepped_buildings.
  orderBy("grid").
  write.partitionBy("cty").
  mode(SaveMode.Overwrite).
  json(outfolder)
