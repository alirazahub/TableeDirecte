import { database } from './changes.js'
import { demoRecords } from './demo-data.js'
import { demoAccounts, demoCustomer } from '../lib/roles.js'

const databaseName = process.env.MONGODB_DATABASE
if (process.env.DEMO_MODE !== 'true' || !databaseName || !/Demo$/i.test(databaseName) || !process.env.MONGODB_URI) {
  console.error('Set DEMO_MODE=true, MONGODB_URI, and a separate MONGODB_DATABASE ending in Demo.')
  process.exit(1)
}

try {
  const collection = await database()
  const records = demoRecords()
  const operations = records.map(record => {
    const {_id,...fields} = record
    return {updateOne:{filter:{_id},update:{$setOnInsert:fields},upsert:true}}
  })
  const result = await collection.bulkWrite(operations,{ordered:false})
  console.log('Demo database ' + databaseName + ': ' + result.upsertedCount + ' inserted, ' + result.matchedCount + ' existing records preserved.')
  console.table([...demoAccounts.map(([username,password]) => ({username,password,kind:'staff'})),{...demoCustomer,kind:'customer'}])
} catch (error) {
  console.error('MongoDB seed failed: ' + (error.codeName || error.name))
  process.exitCode = 1
} finally {
  const {closeDatabase} = await import('./changes.js')
  await closeDatabase()
}
