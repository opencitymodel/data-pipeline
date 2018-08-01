package org.ocm.spark.citygml

import scala.collection.JavaConverters._

import java.io.File

import org.apache.spark.sql.Row
import org.apache.spark.sql.sources.v2.writer.{DataSourceWriter, DataWriter, DataWriterFactory, WriterCommitMessage}

import org.citygml4j.CityGMLContext
import org.citygml4j.model.citygml.core.CityModel
import org.citygml4j.model.citygml.core.CityObjectMember
import org.citygml4j.builder.jaxb.CityGMLBuilder
import org.citygml4j.model.citygml.building.Building
import org.citygml4j.model.module.citygml.CityGMLVersion
import org.citygml4j.xml.io.CityGMLOutputFactory
import org.citygml4j.xml.io.writer.CityGMLWriter
import org.citygml4j.model.gml.geometry.aggregates.MultiSurface
import org.citygml4j.model.gml.geometry.aggregates.MultiSurfaceProperty
import org.citygml4j.model.gml.geometry.primitives.Solid
import org.citygml4j.model.gml.geometry.primitives.SolidProperty
import org.citygml4j.model.gml.geometry.primitives.SurfaceProperty
import org.citygml4j.factory.GMLGeometryFactory
import org.citygml4j.util.gmlid.GMLIdManager
import org.citygml4j.util.gmlid.DefaultGMLIdManager
import org.citygml4j.model.gml.geometry.complexes.CompositeSurface


private final class CityGmlDataSourceWriter(lod: Int, path: String) extends DataSourceWriter {
  override def createWriterFactory(): DataWriterFactory[Row] = {
    new CityGmlDataWriterFactory(lod, path)
  }

  override def commit(messages: Array[WriterCommitMessage]): Unit = {
    // TODO
  }

  override def abort(messages: Array[WriterCommitMessage]): Unit = {
    // TODO
  }
}


private final class CityGmlDataWriterFactory(lod: Int, path: String) extends DataWriterFactory[Row] {
  override def createDataWriter(partitionId: Int, attemptNumber: Int): DataWriter[Row] = {
    new CityGmlDataWriter(lod, filePath(path, partitionId))
  }

  private def filePath(root: String, index: Int): String = root + "/" + "%05d".format(index) + ".gml"
}


private final class CityGmlDataWriter(lod: Int, path: String) extends DataWriter[Row] {

  val cityModel = new CityModel
  val geom:GMLGeometryFactory = new GMLGeometryFactory()
  val gmlIdManager:GMLIdManager = DefaultGMLIdManager.getInstance()

  /** Called for each row of data passed through our writer */
  override def write(row: Row): Unit = {
    // depending on our desired LOD output create the building model appropriately
    if (lod == 0) {
      cityModel.addCityObjectMember(new CityObjectMember(createBuildingLOD0(row.getString(0), row.getSeq[Seq[Row]](1))))
    } else {
      // default is LOD1
      cityModel.addCityObjectMember(new CityObjectMember(createBuildingLOD1(row.getString(0), row.getSeq[Seq[Row]](1))))
    }
  }

  /** Called once after all rows have been written */
  override def commit(): WriterCommitMessage = {
    if (cityModel.isSetCityObjectMember) {
      val ctx:CityGMLContext = CityGMLContext.getInstance()
      val builder:CityGMLBuilder = ctx.createCityGMLBuilder(getClass().getClassLoader())
      val out:CityGMLOutputFactory = builder.createCityGMLOutputFactory(CityGMLVersion.DEFAULT)
      val writer:CityGMLWriter = out.createCityGMLWriter(new File(path), "UTF-8")
      // TODO: add 'boundedBy'
      writer.setPrefixes(CityGMLVersion.DEFAULT)
      writer.setSchemaLocations(CityGMLVersion.DEFAULT)
      writer.setIndentString("  ")
      writer.write(cityModel)
      writer.close()
    }
    CityGmlWriterCommitMessage()
  }

  override def abort(): Unit = {
  }


  /** Create an LOD0 building footprint **/
  private def createBuildingLOD0(id: String, polygons: Seq[Seq[Row]]): Building = {

    // we should only ever have a single polygon for an LOD0 footprint, so isolate that now
    val polygon: Seq[Row] = polygons.head

    val footprint = new MultiSurface()
    footprint.addSurfaceMember(
      new SurfaceProperty(
        geom.createLinearPolygon(new java.util.ArrayList[java.lang.Double](polygon.flatMap(row => Seq[java.lang.Double](row.getAs[java.lang.Double](0), row.getAs[java.lang.Double](1), row.getAs[java.lang.Double](2))).asJava), 3)
      )
    )

    val building = new Building()
    building.setId(id)
    building.setLod0FootPrint(new MultiSurfaceProperty(footprint))

    // TODO: add custom attributes

    building
  }

  /** Create an LOD1 building solid **/
  private def createBuildingLOD1(id: String, polygons: Seq[Seq[Row]]): Building = {

    val exterior = new SurfaceProperty(
      new CompositeSurface(
        polygons.map(polygon =>
          geom.createLinearPolygon(new java.util.ArrayList[java.lang.Double](polygon.flatMap(row => Seq[java.lang.Double](row.getAs[java.lang.Double](0), row.getAs[java.lang.Double](1), row.getAs[java.lang.Double](2))).asJava), 3)
        ): _*
      )
    )

    val solid = new Solid()
    solid.setExterior(exterior)

    val building = new Building()
    building.setId(id)
    building.setLod1Solid(new SolidProperty(solid))
    building
  }

}

case class CityGmlWriterCommitMessage() extends WriterCommitMessage

object CityGmlDataSourceWriter {
  def apply(lod: Int, path: String) : DataSourceWriter = new CityGmlDataSourceWriter(lod, path)
}