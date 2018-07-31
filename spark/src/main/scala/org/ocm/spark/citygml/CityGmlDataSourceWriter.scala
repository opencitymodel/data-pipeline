package org.ocm.spark.citygml

import scala.collection.JavaConverters._

import java.io.File
import java.util.ArrayList

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
import org.citygml4j.model.gml.geometry.primitives.Solid
import org.citygml4j.model.gml.geometry.primitives.SolidProperty
import org.citygml4j.model.gml.geometry.primitives.SurfaceProperty
import org.citygml4j.factory.GMLGeometryFactory
import org.citygml4j.util.gmlid.GMLIdManager
import org.citygml4j.util.gmlid.DefaultGMLIdManager
import org.citygml4j.model.gml.geometry.complexes.CompositeSurface

private final class CityGmlDataSourceWriter(path: String) extends DataSourceWriter {
  override def createWriterFactory(): DataWriterFactory[Row] = {
    new CityGmlDataWriterFactory(path)
  }

  override def commit(messages: Array[WriterCommitMessage]): Unit = {
    // TODO
  }

  override def abort(messages: Array[WriterCommitMessage]): Unit = {
    // TODO
  }
}

private final class CityGmlDataWriterFactory(path:String) extends DataWriterFactory[Row] {
  override def createDataWriter(partitionId: Int, attemptNumber: Int): DataWriter[Row] = {
    new CityGmlDataWriter(filePath(path, partitionId))
  }

  private def filePath(root: String, index: Int): String = root + "/" + "%05d".format(index) + ".gml"
}

private final class CityGmlDataWriter(path: String) extends DataWriter[Row] {

  val cityModel = new CityModel
  val geom:GMLGeometryFactory = new GMLGeometryFactory()
  val gmlIdManager:GMLIdManager = DefaultGMLIdManager.getInstance()

  override def write(row: Row): Unit = {
    cityModel.addCityObjectMember(
      new CityObjectMember(
        createBuliding(row.getString(0), row.getSeq[Seq[Row]](1))
      )
    )
  }

  override def commit(): WriterCommitMessage = {
    if (cityModel.isSetCityObjectMember) {
      val ctx:CityGMLContext = CityGMLContext.getInstance()
      val builder:CityGMLBuilder = ctx.createCityGMLBuilder(getClass().getClassLoader())
      val out:CityGMLOutputFactory = builder.createCityGMLOutputFactory(CityGMLVersion.DEFAULT)
      val writer:CityGMLWriter = out.createCityGMLWriter(new File(path), "UTF-8")
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


  private def createBuliding(id: String, polygons: Seq[Seq[Row]]): Building = {

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
  def apply(path: String) : DataSourceWriter = new CityGmlDataSourceWriter(path)
}