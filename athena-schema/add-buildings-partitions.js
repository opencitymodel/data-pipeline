
STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "DistrictofColumbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "NewHampshire", "NewJersey", "NewMexico", "NewYork", "NorthCarolina", "NorthDakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "RhodeIsland", "SouthCarolina", "SouthDakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "WestVirginia", "Wisconsin", "Wyoming"]

const VERSION='jun2019'
const TABLE='buildings'

const partitions = STATES.map(state => `PARTITION (version = '${VERSION}', state = '${state}')`)
const partitionsStr = partitions.join('\n')

const sql = `ALTER TABLE ${TABLE} ADD IF NOT EXISTS\n${partitionsStr}`

// this is just going to construct the SQL statement which can be pasted in the Athena console
console.log(sql)
