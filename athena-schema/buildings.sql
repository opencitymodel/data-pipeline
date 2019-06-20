CREATE EXTERNAL TABLE `buildings`(
  `hash` string COMMENT 'from deserializer',
  `ubid` string COMMENT 'from deserializer',
  `county` string COMMENT 'from deserializer',
  `grid` string COMMENT 'from deserializer',
  `lat` float COMMENT 'from deserializer',
  `lon` float COMMENT 'from deserializer',
  `area` double COMMENT 'from deserializer',
  `height` double COMMENT 'from deserializer',
  `height_source` string COMMENT 'from deserializer',
  `height_predict` double COMMENT 'from deserializer',
  `fp_source` string COMMENT 'from deserializer')
PARTITIONED BY (
  `version` string,
  `state` string)
ROW FORMAT SERDE
  'org.openx.data.jsonserde.JsonSerDe'
STORED AS INPUTFORMAT
  'org.apache.hadoop.mapred.TextInputFormat'
OUTPUTFORMAT
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://ocm-buildings/'
TBLPROPERTIES (
  'has_encrypted_data'='false')