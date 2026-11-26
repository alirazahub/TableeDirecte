import express from 'express'
import { MongoClient } from 'mongodb'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import QRCode from 'qrcode'
import nodemailer from 'nodemailer'
import { menu } from '../lib/menu.js'

const app = express()
app.use(express.json({limit:'24kb'}))
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
const env = process.env
const demo = env.DEMO_MODE === 'true'
const staffPin = env.STAFF_PIN || '2468'
const configured = Boolean(env.MONGODB_URI && env.STAFF_PIN && env.TABLE_KEY)
let connection
app.use((req, res, next) => {
  if (!demo && !configured && req.path !== '/config') {
    return res.status(503).json({error:'Restaurant service has not been configured.'})
  }
  next()
})
function collection() {
  if (!env.MONGODB_URI) return null
  connection ??= MongoClient.connect(env.MONGODB_URI, {serverSelectionTimeoutMS:5000})
    .then(client => client.db(env.MONGODB_DATABASE || 'TableeDirecte').collection('tables'))
    .catch(error => {connection = null; throw error})
  return connection
}
const memory = new Map()
const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b))
const isStaff = req => equal(req.get('X-Staff-Pin'), staffPin)
const tableIds = Array.from({length:12}, (_, i) => String(i + 1))
const empty = id => ({_id:id, version:0, orders:[], calls:[], payments:[], reviews:[]})
async function lookup(id) {
  const tables = await collection()
  return tables ? await tables.findOne({_id:id}) || empty(id) : memory.get(id) || empty(id)
}
const problem = (status, message) => Object.assign(new Error(message), {status})
async function update(id, change) {
  const tables = await collection()
  for (let attempt = 0; attempt < 8; attempt++) {
    const before = await lookup(id)
    const after = structuredClone(before)
    change(after)
    after.version++
    if (!tables) {
      if ((memory.get(id)?.version || 0) !== before.version) continue
      memory.set(id, after)
      return after
    }
    try {
      const result = await tables.replaceOne({_id:id, version:before.version}, after, {upsert: before.version === 0})
      if (result.modifiedCount || result.upsertedCount) return after
    } catch (error) {
      if (error.code !== 11000) throw error
    }
  }
  throw problem(409, 'The table changed. Please try again.')
}
const orderTotal = order => order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
const total = data => data.orders.reduce((sum, order) => sum + orderTotal(order), 0)
const due = data => total(data) - data.payments.reduce((sum, payment) => sum + payment.amount, 0)
const tableKey = id => demo && !env.TABLE_KEY ? '' : createHmac('sha256', env.TABLE_KEY).update(id).digest('hex')
const guestData = data => ({...data, reviews:undefined, payments:data.payments.map(({email, ...payment}) => payment)})
app.param('id', (req, res, next, id) => {
  if (!tableIds.includes(id)) return next(problem(404, 'Table not found.'))
  if (!isStaff(req) && !equal(req.get('X-Table-Key') || '', tableKey(id))) return next(problem(403, 'Scan the QR code on your table to continue.'))
  next()
})
app.get('/config', (req, res) => res.json({demo, wifi:env.GUEST_WIFI || 'Tablée Directe Guest', wifiPassword:env.GUEST_WIFI_PASSWORD || ''}))
app.get('/tables', async (req, res) => {
  if (!isStaff(req)) throw problem(401, 'Enter your staff PIN.')
  res.json(await Promise.all(tableIds.map(lookup)))
})
app.get('/tables/:id/qr', async (req, res) => {
  if (!isStaff(req)) throw problem(401, 'Enter your staff PIN.')
  const hostedUrl = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
  const url = new URL(env.PUBLIC_URL || (hostedUrl ? 'https://' + hostedUrl : 'http://localhost:3000'))
  url.searchParams.set('table', req.params.id)
  if (tableKey(req.params.id)) url.searchParams.set('key', tableKey(req.params.id))
  res.json({url:url.href, image:await QRCode.toDataURL(url.href)})
})
app.get('/tables/:id', async (req,res) => res.json(guestData(await lookup(req.params.id))))
app.post('/tables/:id', async (req, res) => {
  const {action, items, orderId, callId, status, amount, tip, rating, comment, email} = req.body
  const staff = isStaff(req)
  const now = Date.now()
  const id = randomUUID()
  let receipt
  const data = await update(req.params.id, state => {
    switch (action) {
      case 'order': {
        if (!Array.isArray(items) || !items.length || items.length > menu.length || new Set(items.map(item => item?.id)).size !== items.length) throw problem(400, 'Choose at least one dish.')
        const lines = items.map(item => {
          const dish = menu.find(dish => dish.id === item?.id)
          if (!dish || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw problem(400, 'Invalid item or quantity.')
          return {id:dish.id, name:dish.name, price:dish.price, quantity:item.quantity}
        })
        state.orders.push({id, items:lines, status:'Placed', createdAt:now, updatedAt:now})
        break
      }
      case 'call':
        if (!state.calls.some(call => !call.resolved)) state.calls.push({id, createdAt:now, resolved:false})
        break
      case 'review':
        if (!state.payments.length || due(state) !== 0 || !Number.isInteger(rating) || rating < 1 || rating > 5) throw problem(400, 'Pay your bill and select a rating.')
        if (state.reviews.length) throw problem(409, 'This table has already left a review.')
        state.reviews.push({id, rating, comment:String(comment || '').slice(0, 500), createdAt:now})
        break
      case 'pay':
        if (!demo && !staff) throw problem(403, 'Ask your waiter to collect payment.')
        if (!Number.isInteger(amount) || amount <= 0 || amount > due(state) || !Number.isInteger(tip) || tip < 0 || tip > amount) throw problem(400, 'Enter a valid payment amount and tip.')
        if (email && (typeof email !== 'string' || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw problem(400, 'Enter a valid email address.')
        receipt = {id, amount, tip, email:email || '', createdAt:now}
        state.payments.push(receipt)
        break
      case 'status': {
        if (!staff) throw problem(403, 'Staff access required.')
        const order = state.orders.find(order => order.id === orderId)
        const next = {'Placed':'Cooking', 'Cooking':'Ready', 'Ready':'Served'}
        if (!order || !next[order.status] || next[order.status] !== status) throw problem(409, 'That order has already changed.')
        Object.assign(order, {status, updatedAt:now})
        break
      }
      case 'resolve': {
        if (!staff) throw problem(403, 'Staff access required.')
        const call = state.calls.find(call => call.id === callId)
        if (!call) throw problem(404, 'Request not found.')
        call.resolved = true
        break
      }
      case 'close':
        if (!staff) throw problem(403, 'Staff access required.')
        if (due(state) || state.orders.some(order => order.status !== 'Served') || state.calls.some(call => !call.resolved)) throw problem(409, 'Serve all orders, resolve waiter calls, and settle the bill before closing.')
        Object.assign(state, empty(state._id), {version:state.version})
        break
      default: throw problem(400, 'Unknown action.')
    }
  })
  let notice
  if (receipt?.email) {
    if (env.SMTP_URL && env.RECEIPT_FROM) {
      try {
        await nodemailer.createTransport(env.SMTP_URL).sendMail({
          from:env.RECEIPT_FROM, to:receipt.email, subject:'Your Tablée Directe receipt',
          text:'Table ' + req.params.id + '\nReceipt ' + receipt.id + '\nBill: $' + (receipt.amount / 100).toFixed(2) + '\nTip: $' + (receipt.tip / 100).toFixed(2) + '\nPaid: $' + ((receipt.amount + receipt.tip) / 100).toFixed(2),
        })
        notice = 'Payment recorded and receipt emailed.'
      } catch { notice = 'Payment recorded. Receipt email could not be sent.' }
    } else notice = 'Payment recorded. Receipt email is unavailable.'
  }
  res.json({table:guestData(data), notice})
})
app.use((error, req, res, next) => {
  if (!error.status) console.error(error)
  res.status(error.status || 500).json({error:error.status && error.status < 500 ? error.message : 'Something went wrong.'})
})
export default app
