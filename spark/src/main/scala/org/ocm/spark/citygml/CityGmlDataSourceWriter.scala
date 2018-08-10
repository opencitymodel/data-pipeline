package org.ocm.spark.citygml

import scala.collection.JavaConverters._

import java.io.File

import net.opengis.citygml.generics._1.StringAttributeType

import org.apache.spark.sql.Row
import org.apache.spark.sql.sources.v2.writer.{DataSourceWriter, DataWriter, DataWriterFactory, WriterCommitMessage}
import org.apache.spark.sql.types._

import org.citygml4j.CityGMLContext
import org.citygml4j.builder.jaxb.CityGMLBuilder
import org.citygml4j.factory.GMLGeometryFactory
import org.citygml4j.model.citygml.ade.generic.ADEGenericElement
import org.citygml4j.model.citygml.building.Building
import org.citygml4j.model.citygml.core.CityModel
import org.citygml4j.model.citygml.core.CityObjectMember
import org.citygml4j.model.citygml.generics.StringAttribute
import org.citygml4j.model.gml.geometry.aggregates.MultiSurface
import org.citygml4j.model.gml.geometry.aggregates.MultiSurfaceProperty
import org.citygml4j.model.gml.geometry.complexes.CompositeSurface
import org.citygml4j.model.gml.geometry.primitives.Solid
import org.citygml4j.model.gml.geometry.primitives.SolidProperty
import org.citygml4j.model.gml.geometry.primitives.SurfaceProperty
import org.citygml4j.model.module.citygml.CityGMLVersion
import org.citygml4j.util.gmlid.GMLIdManager
import org.citygml4j.util.gmlid.DefaultGMLIdManager
import org.citygml4j.xml.io.CityGMLOutputFactory
import org.citygml4j.xml.io.writer.CityGMLWriter


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

  val ctx:CityGMLContext = CityGMLContext.getInstance()

  val cityModel = new CityModel
  val geom:GMLGeometryFactory = new GMLGeometryFactory()
  val gmlIdManager:GMLIdManager = DefaultGMLIdManager.getInstance()

  /** Called for each row of data passed through our writer */
  override def write(row: Row): Unit = {
    val idIdx = row.fieldIndex("id")
    val polygonsIdx = row.fieldIndex("polygons")

    val building = new Building()
    building.setId(row.getString(idIdx))

    // depending on our desired LOD output create the building model appropriately
    if (lod == 0) {
      createBuildingLOD0(building, row.getSeq[Row](polygonsIdx))
    } else {
      // default is LOD1
      createBuildingLOD1(building, row.getSeq[Seq[Row]](polygonsIdx))
    }

    // TODO: track bounding area in a reducer like fashion so we can add that to the gml

    // add custom attributes (any column of StringType that is not one of our required columns)
    val extraAttrs = row.schema.
                      filter((f:StructField) => f.name != "id" && f.name != "footprint" && f.name != "polygons" && f.dataType == StringType).
                      map((f:StructField) => new StringAttribute(f.name, row.getString(row.fieldIndex(f.name))))
    for (attr <- extraAttrs) building.addGenericAttribute(attr)

    // add the building to the city
    cityModel.addCityObjectMember(new CityObjectMember(building));
  }

  /** Called once after all rows have been written */
  override def commit(): WriterCommitMessage = {
    if (cityModel.isSetCityObjectMember) {
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
  private def createBuildingLOD0(building: Building, polygon: Seq[Row]): Building = {
    val footprint = new MultiSurface()
    footprint.addSurfaceMember(
      new SurfaceProperty(
        geom.createLinearPolygon(new java.util.ArrayList[java.lang.Double](polygon.flatMap(row => Seq[java.lang.Double](row.getAs[java.lang.Double](0), row.getAs[java.lang.Double](1), row.getAs[java.lang.Double](2))).asJava), 3)
      )
    )

    building.setLod0FootPrint(new MultiSurfaceProperty(footprint))
    building
  }

  /** Create an LOD1 building solid **/
  private def createBuildingLOD1(building: Building, polygons: Seq[Seq[Row]]): Building = {

    val exterior = new SurfaceProperty(
      new CompositeSurface(
        polygons.map(polygon =>
          geom.createLinearPolygon(new java.util.ArrayList[java.lang.Double](polygon.flatMap(row => Seq[java.lang.Double](row.getAs[java.lang.Double](0), row.getAs[java.lang.Double](1), row.getAs[java.lang.Double](2))).asJava), 3)
        ): _*
      )
    )

    val solid = new Solid()
    solid.setExterior(exterior)

    building.setLod1Solid(new SolidProperty(solid))
    building
  }

}

case class CityGmlWriterCommitMessage() extends WriterCommitMessage

object CityGmlDataSourceWriter {
  def apply(lod: Int, path: String) : DataSourceWriter = new CityGmlDataSourceWriter(lod, path)
}