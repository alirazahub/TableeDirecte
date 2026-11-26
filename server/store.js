import { demo, drivers, identityConfigured } from './auth.js'
import { database } from './changes.js'
import { demoRecords } from './demo-data.js'

const env = process.env
export const configured = Boolean(env.MONGODB_URI && env.TABLE_KEY?.length >= 32 && identityConfigured)
export const memory = new Map(demo && !env.MONGODB_URI ? demoRecords().map(record => [record._id,record]) : [])
export const tableIds = Array.from({length:12}, (_, i) => String(i + 1))
export const tableRoles = ['manager','reception','floor','kitchen']
export const dispatchRoles = ['manager','reception']
export const deliveryRoles = ['manager','reception','kitchen','delivery']
export const deliveryRecordId = id => 'delivery-' + id
export const empty = id => ({_id:id,version:0,orders:[],calls:[],payments:[],reviews:[],history:[]})

export async function lookup(id) {
  const db = await database()
  return db ? await db.findOne({_id:id}) || empty(id) : memory.get(id) || empty(id)
}
export const availability = async () => (await lookup('menu-settings')).unavailable || []
const safePayments = records => records.map(({email,...payment}) => payment)
export const guestData = ({history,reviews,seating,...visit}) => ({
  ...visit,reviewed:Boolean(reviews?.length),payments:safePayments(visit.payments),
})
export function staffTable({history,reviews,seating,...visit},role) {
  if (role === 'kitchen') return {_id:visit._id,version:visit.version,orders:visit.orders,calls:[],payments:[]}
  return {...visit,seating,reviews:role === 'manager' ? reviews : [],history:role === 'manager' ? history : [],
    payments:safePayments(visit.payments)}
}
export async function staffTables(role) {
  const db = await database()
  const records = db ? await db.find({_id:{$in:tableIds}}).toArray() : tableIds.map(id => memory.get(id)).filter(Boolean)
  const indexed = new Map(records.map(record => [record._id,record]))
  return tableIds.map(id => staffTable(indexed.get(id) || empty(id),role))
}
export const deliveryPublic = record => ({
  id:record.id,version:record.version,createdAt:record.createdAt,items:record.items,total:record.total,status:record.status,
  events:record.events,location:record.status === 'Out for delivery' ? record.location : undefined,
})
export const deliveryFor = (record,role) => role === 'kitchen'
  ? {...deliveryPublic(record),note:record.note}
  : {...deliveryPublic(record),recipient:record.recipient,address:record.address,phone:record.phone,driver:record.driver,note:record.note}
export async function staffDeliveries({role,username}) {
  const db = await database()
  const filter = role === 'delivery' ? {driver:username} : {}
  const records = db ? await db.find({_id:/^delivery-/,...filter}).sort({createdAt:-1}).limit(150).toArray()
    : [...memory.values()].filter(record => record._id.startsWith('delivery-') &&
        (role !== 'delivery' || record.driver === username)).sort((a,b) => b.createdAt-a.createdAt).slice(0,150)
  return {drivers:dispatchRoles.includes(role) ? drivers() : [],orders:records.map(record => deliveryFor(record,role))}
}
