CREATE EXTERNAL TABLE `footprints`(
  `type` string COMMENT 'from deserializer',
  `properties` map<string,string> COMMENT 'from deserializer',
  `geometry` map<string,string> COMMENT 'from deserializer')
PARTITIONED BY (
  `datasource` string,
  `state` string)
ROW FORMAT SERDE
  'org.openx.data.jsonserde.JsonSerDe'
STORED AS INPUTFORMAT
  'org.apache.hadoop.mapred.TextInputFormat'
OUTPUTFORMAT
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://ocm-footprints/'
TBLPROPERTIES (
  'has_encrypted_data'='false')