package org.ocm.spark.citygml

import java.io.File
import java.util

import com.google.common.collect.Lists
import org.apache.spark.sql.types.{DataTypes, DoubleType, StructField, StructType}
import org.apache.spark.sql.{Row, SparkSession}


object CityGmlDataSourceTestEnv {
  val ROW_NUMBER: Int = 100
  val PARTITION_NUMBER: Int = 2

  def sparkSession(name : String) : SparkSession = {
    SparkSession.builder().
      appName(name).
      master("local[2]").
      config(SparkCtxCfg.SPARK_EXECUTOR_MEMORY, "1g").
      config(SparkCtxCfg.SPARK_SERIALIZER, SparkCtxCfg.KRYO).
      config(SparkCtxCfg.SPARK_SQL_SHUFFLE_PARTITIONS, "2").
      config(SparkCtxCfg.SPARK_WAREHOUSE_DIR, "target/spark-warehouse").
      config(SparkCtxCfg.SPARK_JARS, SparkCtxCfg.toAbsolutePaths("", "")).
      config(SparkCtxCfg.SPARK_DRIVER_HOST, "localhost").
      config(SparkCtxCfg.SPARK_DRIVER_PORT, "31000").
      getOrCreate()
  }

  def defaultSchema = List(
    StructField("id", DataTypes.StringType, false),
    StructField("polygons", DataTypes.createArrayType(
      DataTypes.createArrayType(
        DataTypes.createStructType(
          Array(StructField("x", DoubleType, false)
          , StructField("y", DoubleType, false)
          , StructField("z", DoubleType, false))
        ),false), false)),
    StructField("grid", DataTypes.StringType, false)
  )

//  def extrude(polygon:Array[Array[Double]], height: Double): Seq[Array[Array[Double]]] = {
//    Seq(
//      polygon,
//      polygon.map(points => points.map(point => Array(point(0), point(1), height)))
//    )
//  }

  def createTestDataFrameRows(now: Long): util.List[Row] = {
    val rows: util.List[Row] = Lists.newArrayListWithCapacity(ROW_NUMBER)

    var i: Int = 0
    while (i < ROW_NUMBER) {
      {
        val polygons = Seq(
          Seq(
            (20d * i, 0d, 0d),
            (20d * i, 10d, 0d),
            (20d * i + 10d, 10d, 0d),
            (20d * i + 10d, 0d, 0d)
          ),
          Seq(
            (20d * i, 0d, 10d),
            (20d * i, 10d, 10d),
            (20d * i + 10d, 10d, 10d),
            (20d * i + 10d, 0d, 10d)
          ),
          Seq(
            (20d * i, 0d, 0d),
            (20d * i, 10d, 0d),
            (20d * i, 10d, 10d),
            (20d * i, 0d, 10d)
          ),
          Seq(
            (20d * i, 10d, 0d),
            (20d * i + 10d, 10d, 0d),
            (20d * i + 10d, 10d, 10d),
            (20d * i, 10d, 10d)
          ),
          Seq(
            (20d * i, 10d, 0d),
            (20d * i + 10d, 10d, 0d),
            (20d * i + 10d, 10d, 10d),
            (20d * i, 10d, 10d)
          ),
          Seq(
            (20d * i, 0d, 0d),
            (20d * i + 10d, 0d, 0d),
            (20d * i + 10d, 0d, 10d),
            (20d * i, 0d, 10d)
          )
        )
        rows.add(Row(i.toString, polygons, "abc"))
        i += 1
      }
    }
    rows
  }

  def createLod0TestDataFrameRows(): util.List[Row] = {
    val rows: util.List[Row] = Lists.newArrayListWithCapacity(ROW_NUMBER)

    val polygons = Seq(
      Seq(
        (0d, 0d, 0d),
        (20d, 0d, 0d),
        (20d, 20d, 0d),
        (0d, 20d, 0d)
      )
    )

    rows.add(Row("building-id", polygons))
    rows
  }
}

object SparkCtxCfg {
  val SPARK_EXECUTOR_MEMORY = "spark.executor.memory"

  val SPARK_SERIALIZER = "spark.serializer"

  val ALLOW_MULTIPLE_CONTEXTS = "spark.driver.allowMultipleContexts"

  val SPARK_JARS = "spark.jars"

  val SPARK_WAREHOUSE_DIR = "spark.sql.warehouse.dir"

  val KRYO = "org.apache.spark.serializer.KryoSerializer"

  val SPARK_SQL_SHUFFLE_PARTITIONS = "spark.sql.shuffle.partitions"

  val DEFAULT_SPARK_MASTER_URL = "spark://127.0.0.1:7077"

  val SPARK_DRIVER_HOST = "spark.driver.host"

  val SPARK_DRIVER_PORT = "spark.driver.port"

  def envProperty(name : String, otherwise : String) : String = {
    val prop = System.getProperty(name)
    if (prop == null) otherwise else prop
  }

  def availableProcessors() : String = {
    Integer.toString(Runtime.getRuntime.availableProcessors())
  }

  def toAbsolutePaths(jarsString: String, baseDir: String): String = {
    if (jarsString == null || jarsString.length == 0) {
      return ""
    }
    val libDir: String = if (baseDir.endsWith(File.separator)) baseDir
    else baseDir + File.separator
    toAbsolutePaths(libDir, jarsString.split(",")).mkString(",")
  }

  private def toAbsolutePaths(libDir: String, jarFileNames: Array[String]): Array[String] = {
    jarFileNames.map(jar => libDir + jar)
  }
}


