name := "spark-citygml"

version := "0.1.2"

scalaVersion := "2.11.12"

libraryDependencies ++= Seq (
  "org.apache.spark" %% "spark-core" % "2.3.1",
  "org.apache.spark" %% "spark-sql" % "2.3.1",
  "org.citygml4j" % "citygml4j" % "2.7.0",
  "org.scalatest" %% "scalatest" % "3.0.5" % "test"
)