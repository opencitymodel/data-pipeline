// Databricks notebook source
val version:String = dbutils.widgets.get("version")

// read in the building data
val df = spark.read.json("/mnt/ocm-buildings/version="+version+"/*/*/*.json").cache

// COMMAND ----------

// create a WKT version of the footprint
val toWKT = udf((lines:Seq[Seq[Seq[Double]]]) => {
  "POLYGON("+lines.map(line => "("+line.map(pt => pt.head+" "+pt.last).mkString(",")+")").mkString(",")+")"
})

val transformed = df.withColumn("fp", toWKT($"geometry.coordinates")).drop("geometry").cache

// COMMAND ----------

// output to Parquet (default compression = snappy)
transformed.write
  .partitionBy("state", "county")
  .mode(SaveMode.Overwrite)
  .parquet("/mnt/ocm-buildings-db/version="+version+"/")
