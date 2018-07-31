package org.ocm.spark.citygml

import java.util.Optional

import org.apache.spark.sql.SaveMode
import org.apache.spark.sql.sources.v2.writer.DataSourceWriter
import org.apache.spark.sql.sources.v2.{DataSourceOptions, DataSourceV2, WriteSupport}
import org.apache.spark.sql.types.StructType

class CityGmlDataSource extends DataSourceV2 with WriteSupport {

  override def createWriter(jobId: String, schema: StructType, mode: SaveMode, options: DataSourceOptions): Optional[DataSourceWriter] = {
    // TODO: Check schema to ensure necessary fields are present
    Optional.of(CityGmlDataSourceWriter(options.get(CityGmlDataSource.PATH).get()))
  }
}

object CityGmlDataSource {
  /** alternative/long format name for when "META-INF.services" trick is not used */
  val FORMAT: String = "org.ocm.spark.citygml"

  /** The default/short format name, usage example: "df.write.format(CityGmlDataSource.SHORT_NAME)" */
  val SHORT_NAME: String = "CityGmlDataSource"

  /** The root directory (presumably in a DFS) for Lucene data storage item. IRL would be based on tenantId/data version/etc */
  val PATH : String = "path"

}