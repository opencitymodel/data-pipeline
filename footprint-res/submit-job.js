const DataBricks = require('databricks-api')

// the data we want to process
// use 'all' for STATE if you want to run every state
VERSION = process.argv[2]
STATE = process.argv[3]

if (!VERSION || !STATE) {
  console.error(`Missing arguments.  usage: node submit-job.js <version> <state>`)
  process.exit(1)
}

if (!process.env.DATABRICKS_DOMAIN || !process.env.DATABRICKS_TOKEN || !process.env.DATABRICKS_JOB_ID) {
  console.error(`Missing databricks environment variables: 'DATABRICKS_DOMAIN', 'DATABRICKS_TOKEN', 'DATABRICKS_JOB_ID'`)
  process.exit(1)
}

const client = new DataBricks({
  domain: process.env.DATABRICKS_DOMAIN,
  token: process.env.DATABRICKS_TOKEN
})

STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "DistrictofColumbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "NewHampshire", "NewJersey", "NewMexico", "NewYork", "NorthCarolina", "NorthDakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "RhodeIsland", "SouthCarolina", "SouthDakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "WestVirginia", "Wisconsin", "Wyoming"]

async function sleep(ms){
  return new Promise(resolve=>{
    setTimeout(resolve,ms)
  })
}

const runAndWait = async (version, state) => {
  return new Promise((resolve, reject) => {
    // start run
    console.log(`Launching ${state}:${version}`)
    client.Jobs.runNow({
      job_id: process.env.DATABRICKS_JOB_ID,
      notebook_params: {
        state,
        version
      }
    }).then(async res => {
      const run_id = res.run_id

      // poll status until it's done
      while(true) {
        const res = await client.Runs.get({ run_id })
        const msg = res.state.result_state ? res.state.result_state : `${res.state.life_cycle_state}:${res.state.state_message}`
        console.log(run_id, `${state}:${version}`, msg)

        if (res.state.result_state === 'SUCCESS') {
          resolve(res)
          break
        } else if (res.state.result_state || res.state.life_cycle_state === 'SKIPPED') {
          reject(res)
          break
        } else {
          // sleep a while before we go back and do it again
          await sleep(30000)
        }
      }
    }).catch(err => {
      console.error(err)
    })
  })
}

const run = async () => {
  for (let i=0; i < STATES.length; i++) {
    const state = STATES[i]

    if (STATE === 'all' || state === STATE) {
      try {
        await runAndWait(VERSION, state)
      } catch(err) {
        console.error(`Error with ${state}:`, err)
      }
    }
  }
}

run()
