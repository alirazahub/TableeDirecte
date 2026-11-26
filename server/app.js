import express from 'express'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import nodemailer from 'nodemailer'
import { authenticate, customerCookie, customerFromCookie, demo, drivers, duration, equal, hashPassword, identityConfigured, issueCustomer, issueSession, sessionCookie, sessionFromCookie, trackingKey, verifyTracking } from './auth.js'
import { canAccessTable, tableIds, tableKey } from './realtime.js'
import { changes, database } from './changes.js'
import { menu } from '../lib/menu.js'
import { tableBalance, subtotal, paidTotal, tipTotal, serviceReasons, parisDay } from '../lib/operations.js'

const app = express()
app.use(express.json({limit:'24kb'}))
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
const env = process.env
const configured = Boolean(env.MONGODB_URI && env.TABLE_KEY?.length >= 32 && identityConfigured)
const memory = new Map()
const tableRoles = ['manager','reception','floor','kitchen']
const floorRoles = ['manager','reception','floor']
const dispatchRoles = ['manager','reception']
const healthy = req => {
  if (!demo && !configured) throw problem(503, 'Restaurant service has not been configured.')
}
const requireRole = (req, allowed) => {
  if (!req.account) throw problem(401, 'Sign in to continue.')
  if (!allowed.includes(req.account.role)) throw problem(403, 'This action is outside your role.')
}
const hasRole = (req,allowed) => allowed.includes(req.account?.role)
app.use((req,res,next) => {
  if (req.method === 'POST') {
    const allowed = [req.get('host'),req.get('x-forwarded-host'),env.PUBLIC_URL && new URL(env.PUBLIC_URL).host].filter(Boolean)
    const origin = req.get('origin')
    if (origin && (!/^https?:\/\//.test(origin) || !allowed.includes(origin.replace(/^https?:\/\//,'')))) {
      return next(problem(403,'This request came from a different site.'))
    }
  }
  req.account = sessionFromCookie(req.get('cookie'))
  req.customer = customerFromCookie(req.get('cookie'))
  if (!['/config','/session'].includes(req.path)) healthy(req)
  next()
})
const empty = id => ({_id:id, version:0, orders:[], calls:[], payments:[], reviews:[], history:[]})
async function lookup(id) {
  const tables = await database()
  return tables ? await tables.findOne({_id:id}) || empty(id) : memory.get(id) || empty(id)
}
const problem = (status, message) => Object.assign(new Error(message), {status})
async function update(id, change) {
  const tables = await database()
  for (let attempt = 0; attempt < 8; attempt++) {
    const before = await lookup(id)
    const after = structuredClone(before)
    change(after)
    after.version++
    if (!tables) {
      if ((memory.get(id)?.version || 0) !== before.version) continue
      memory.set(id, after)
      changes.emit('change',id)
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
const guestData = ({history, reviews, seating, ...visit}) => ({
  ...visit, reviewed:Boolean(reviews?.length),
  payments:visit.payments.map(({email, ...payment}) => payment),
})
const loginAttempts = new Map()
const cookieOptions = req => ({httpOnly:true,sameSite:'strict',secure:Boolean(env.VERCEL || req.secure || req.get('x-forwarded-proto') === 'https'),path:'/'})
function checkAttempts(req) {
  const address = env.VERCEL ? req.get('x-vercel-forwarded-for') || req.ip : req.ip
  const now = Date.now()
  for (const [key,value] of loginAttempts) if (value.until <= now) loginAttempts.delete(key)
  const attempts = loginAttempts.get(address) || {count:0,until:now+60000}
  if (attempts.count >= 10 || loginAttempts.size >= 2000) throw problem(429,'Too many sign-in attempts. Try again in a minute.')
  return {address,attempts}
}
function failedAttempt(address,attempts) {
  attempts.count++
  loginAttempts.set(address,attempts)
}
app.get('/session',(req,res) => res.json({account: req.account ? {username:req.account.username,role:req.account.role} : null}))
app.post('/session', (req,res) => {
  const {username,password,logout} = req.body || {}
  if (logout === true) {
    res.clearCookie(sessionCookie,cookieOptions(req))
    return res.json({account:null})
  }
  healthy(req)
  const {address,attempts} = checkAttempts(req)
  const account = authenticate(username,password)
  if (!account) {
    failedAttempt(address,attempts)
    throw problem(401,'Account name or password is incorrect.')
  }
  loginAttempts.delete(address)
  res.cookie(sessionCookie,issueSession(account),{...cookieOptions(req),maxAge:duration * 1000})
  res.json({account})
})
app.get('/customer',(req,res) => res.json({username:req.customer?.username || null}))
app.post('/customer',async (req,res) => {
  const {username,password,mode} = req.body || {}
  if (mode === 'logout') {
    res.clearCookie(customerCookie,cookieOptions(req))
    return res.json({username:null})
  }
  const {address,attempts} = checkAttempts(req)
  if (!['register','signin'].includes(mode) || typeof username !== 'string' || !/^[a-z0-9_.-]{3,36}$/.test(username) ||
      typeof password !== 'string' || password.length < 10 || password.length > 200) {
    failedAttempt(address,attempts)
    throw problem(400,'Use 3–36 lowercase letters, numbers or ._- for your username, and a password of at least 10 characters.')
  }
  const id = 'customer-' + username
  if (mode === 'register') {
    failedAttempt(address,attempts)
    if (demo && !env.MONGODB_URI && memory.size >= 500) throw problem(429,'Demo account limit reached.')
    const passwordHash = hashPassword(password)
    await update(id,state => {
      if (state.passwordHash) throw problem(409,'That username is already registered.')
      state.passwordHash = passwordHash
    })
  } else {
    const record = await lookup(id)
    const candidate = hashPassword(password,record.passwordHash?.split(':')[0] || 'invalid-account')
    if (!equal(candidate,record.passwordHash)) {
      failedAttempt(address,attempts)
      throw problem(401,'Account name or password is incorrect.')
    }
    loginAttempts.delete(address)
  }
  res.cookie(customerCookie,issueCustomer(username),{...cookieOptions(req),maxAge:duration * 1000})
  res.json({username})
})
const availability = async () => (await lookup('menu-settings')).unavailable || []
app.get('/menu', async (req, res) => res.json({unavailable:await availability()}))
app.post('/menu', async (req, res) => {
  requireRole(req,['manager','kitchen'])
  const {id, available} = req.body || {}
  if (!menu.some(item => item.id === id) || typeof available !== 'boolean') throw problem(400, 'Choose a valid dish and availability.')
  const settings = await update('menu-settings', state => {
    const items = new Set(state.unavailable || [])
    if (available) items.delete(id)
    else items.add(id)
    state.unavailable = [...items]
  })
  res.json({unavailable:settings.unavailable})
})
app.param('id', (req, res, next, id) => {
  if (!tableIds.includes(id)) return next(problem(404, 'Table not found.'))
  if (!hasRole(req,tableRoles) && !canAccessTable(id,req.get('X-Table-Key'))) return next(problem(403, 'Scan the QR code on your table to continue.'))
  next()
})
app.get('/config', (req, res) => res.json({demo, wifi:env.GUEST_WIFI || 'Tablée Directe Guest', wifiPassword:env.GUEST_WIFI_PASSWORD || ''}))
app.get('/tables', async (req, res) => {
  requireRole(req,tableRoles)
  const records = await Promise.all(tableIds.map(lookup))
  const role = req.account.role
  res.json(records.map(record => {
    const {history,reviews,seating,...visit} = record
    if (role === 'kitchen') return {_id:visit._id,version:visit.version,orders:visit.orders,calls:[],payments:[]}
    return {...visit,seating, reviews:role === 'manager' ? reviews : [], history:role === 'manager' ? history : [],
      payments:visit.payments.map(({email,...payment}) => payment)}
  }))
})
app.get('/tables/:id/qr', async (req, res) => {
  requireRole(req,floorRoles)
  const hostedUrl = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
  const url = new URL(env.PUBLIC_URL || (hostedUrl ? 'https://' + hostedUrl : 'http://localhost:3000'))
  url.searchParams.set('table', req.params.id)
  if (tableKey(req.params.id)) url.searchParams.set('key', tableKey(req.params.id))
  res.json({url:url.href, image:await QRCode.toDataURL(url.href)})
})
app.get('/tables/:id', async (req,res) => res.json(guestData(await lookup(req.params.id))))
function validateLines(items,unavailable) {
  if (!Array.isArray(items) || !items.length || items.length > menu.length || new Set(items.map(item => item?.id)).size !== items.length) throw problem(400, 'Choose at least one dish.')
  return items.map(item => {
    const dish = menu.find(dish => dish.id === item?.id)
    if (!dish || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw problem(400, 'Invalid item or quantity.')
    if (unavailable.includes(dish.id)) throw problem(409, dish.name + ' is currently sold out.')
    return {id:dish.id, name:dish.name, price:dish.price, quantity:item.quantity}
  })
}
app.post('/tables/:id', async (req, res) => {
  const {action, items, orderId, callId, status, amount, tip, rating, comment, email, note, reason, method, party, guestName} = req.body || {}
  const customer = canAccessTable(req.params.id, req.get('X-Table-Key'))
  const staff = hasRole(req,floorRoles)
  const guestAction = ['order','call','review'].includes(action)
  if (guestAction && !customer && !staff) throw problem(403,'Table session required.')
  const now = Date.now()
  const id = randomUUID()
  const unavailable = action === 'order' ? await availability() : []
  let receipt
  const data = await update(req.params.id, state => {
    switch (action) {
      case 'seat': {
        requireRole(req,['manager','reception'])
        if (!Number.isInteger(party) || party < 1 || party > 24) throw problem(400,'Enter a party of 1 to 24.')
        if (state.seating || state.orders.length || state.calls.some(call => !call.resolved)) throw problem(409,'This table is already in use.')
        state.seating = {party,guestName:!demo && typeof guestName === 'string' ? guestName.trim().slice(0,60) : '',seatedAt:now}
        break
      }
      case 'order': {
        const lines = validateLines(items,unavailable)
        state.orders.push({id, items:lines, note:typeof note === 'string' ? note.trim().slice(0, 250) : '', status:'Placed', createdAt:now, updatedAt:now})
        break
      }
      case 'call': {
        const kind = typeof reason === 'string' && Object.hasOwn(serviceReasons, reason) ? reason : 'help'
        if (!state.calls.some(call => !call.resolved && (call.reason || 'help') === kind)) {
          state.calls.push({id, reason:kind, createdAt:now, resolved:false})
        }
        break
      }
      case 'review':
        if (!state.payments.length || tableBalance(state) !== 0 || !Number.isInteger(rating) || rating < 1 || rating > 5) throw problem(400, 'Pay your bill and select a rating.')
        if (state.reviews.length) throw problem(409, 'This table has already left a review.')
        state.reviews.push({id, rating, comment:String(comment || '').slice(0, 500), createdAt:now})
        break
      case 'pay':
        if (!staff && !(demo && customer)) throw problem(403, 'Ask your waiter to collect payment.')
        if (!Number.isInteger(amount) || amount <= 0 || amount > tableBalance(state) || !Number.isInteger(tip) || tip < 0 || tip > amount) throw problem(400, 'Enter a valid payment amount and tip.')
        if (email && (typeof email !== 'string' || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw problem(400, 'Enter a valid email address.')
        const paymentMethod = staff && ['card', 'cash', 'voucher'].includes(method) ? method : demo ? 'demo' : 'card'
        receipt = {id, amount, tip, method:paymentMethod, email:email || '', createdAt:now}
        state.payments.push(receipt)
        break
      case 'status': {
        requireRole(req, status === 'Ready' ? ['manager','kitchen'] : status === 'Cooking' ? [...floorRoles,'kitchen'] : floorRoles)
        const order = state.orders.find(order => order.id === orderId)
        const next = {Placed:['Cooking','Cancelled'], Cooking:['Ready'], Ready:['Served'], Served:[], Cancelled:[]}
        const cancellable = status !== 'Cancelled' || !state.payments.length
        if (!order || !next[order.status]?.includes(status) || !cancellable) throw problem(409, 'That order has already changed.')
        Object.assign(order, {status, updatedAt:now})
        break
      }
      case 'resolve': {
        requireRole(req,floorRoles)
        const call = state.calls.find(call => call.id === callId)
        if (!call) throw problem(404, 'Request not found.')
        call.resolved = true
        break
      }
      case 'close': {
        requireRole(req,floorRoles)
        if (tableBalance(state) || state.orders.some(order => !['Served','Cancelled'].includes(order.status)) || state.calls.some(call => !call.resolved)) throw problem(409, 'Serve all orders, resolve waiter calls, and settle the bill before closing.')
        const history = state.history || []
        if (state.orders.length || state.calls.length || state.seating) {
          const review = state.reviews[0]
          const paymentDays = {}
          for (const payment of state.payments) {
            const day = parisDay(payment.createdAt)
            paymentDays[day] ??= {collected:0,tips:0}
            paymentDays[day].collected += payment.amount
            paymentDays[day].tips += payment.tip
          }
          history.unshift({
            id, closedAt:now, paymentDays, orders:state.orders.filter(order => order.status === 'Served').length,
            cancelled:state.orders.filter(order => order.status === 'Cancelled').length,
            sales:subtotal(state.orders), collected:paidTotal(state.payments), tips:tipTotal(state.payments),
            rating:review?.rating,
          })
        }
        Object.assign(state, empty(state._id), {version:state.version, seating:null, history:history.slice(0, 100)})
        break
      }
      default: throw problem(400, 'Unknown action.')
    }
  })
  let notice
  if (receipt?.email) {
    if (env.SMTP_URL && env.RECEIPT_FROM) {
      try {
        await nodemailer.createTransport(env.SMTP_URL).sendMail({
          from:env.RECEIPT_FROM, to:receipt.email, subject:'Your Tablée Directe receipt',
          text:'Table ' + req.params.id + '\nReceipt ' + receipt.id + '\nBill: EUR ' + (receipt.amount / 100).toFixed(2) + '\nTip: EUR ' + (receipt.tip / 100).toFixed(2) + '\nPaid: EUR ' + ((receipt.amount + receipt.tip) / 100).toFixed(2),
        })
        notice = 'Payment recorded and receipt emailed.'
      } catch { notice = 'Payment recorded. Receipt email could not be sent.' }
    } else notice = 'Payment recorded. Receipt email is unavailable.'
  }
  res.json({table:guestData(data), notice})
})
const deliveryRoles = ['manager','reception','kitchen','delivery']
const deliveryStates = ['Placed','Cooking','Ready','Out for delivery','Delivered','Cancelled']
const deliveryPublic = record => ({
  id:record.id, items:record.items, total:record.total, status:record.status,
  events:record.events, location:record.status === 'Out for delivery' ? record.location : undefined,
})
const deliveryFor = (record,role) => role === 'kitchen'
  ? {...deliveryPublic(record),note:record.note}
  : {...deliveryPublic(record),recipient:record.recipient,address:record.address,phone:record.phone,
     driver:record.driver,note:record.note}
const deliveryRecordId = id => 'delivery-' + id
async function deliveries() {
  const db = await database()
  return db ? db.find({_id:/^delivery-/}).sort({createdAt:-1}).limit(150).toArray()
    : [...memory.values()].filter(record => record._id.startsWith('delivery-')).reverse().slice(0,150)
}
app.get('/deliveries',async (req,res) => {
  requireRole(req,deliveryRoles)
  const {role,username} = req.account
  const records = await deliveries()
  res.json({
    drivers:dispatchRoles.includes(role) ? drivers() : [],
    orders:records.filter(record => role !== 'delivery' || record.driver === username).map(record => deliveryFor(record,role)),
  })
})
app.post('/deliveries',async (req,res) => {
  const {items,note} = req.body || {}
  const {recipient,address,phone} = demo
    ? {recipient:'Demo customer',address:'10 rue de la Démo, 75001 Paris',phone:'0100000000'}
    : req.body || {}
  if (typeof recipient !== 'string' || recipient.trim().length < 2 || recipient.length > 80 ||
      typeof address !== 'string' || address.trim().length < 8 || address.length > 200 ||
      typeof phone !== 'string' || !/^[+0-9 ().-]{7,30}$/.test(phone)) throw problem(400,'Enter a name, complete delivery address, and phone number.')
  const lines = validateLines(items,await availability())
  const id = randomUUID()
  const now = Date.now()
  const record = await update(deliveryRecordId(id), state => Object.assign(state,{
    id, customer: req.customer?.username, items:lines,total:subtotal([{items:lines}]),recipient:recipient.trim(),address:address.trim(),phone,
    note:typeof note === 'string' ? note.trim().slice(0,250) : '',status:'Placed',createdAt:now,
    events:[{status:'Placed',at:now}],
  }))
  res.status(201).json({tracking:trackingKey(id),order:deliveryPublic(record)})
})
app.get('/customer/orders',async (req,res) => {
  if (!req.customer) throw problem(401,'Sign in to see your orders.')
  const db = await database()
  const customer = req.customer.username
  const orders = db ? await db.find({_id:/^delivery-/,customer}).sort({createdAt:-1}).limit(30).toArray()
    : [...memory.values()].filter(record => record.customer === customer).reverse().slice(0,30)
  res.json(orders.map(order => ({...deliveryPublic(order),tracking:trackingKey(order.id)})))
})
app.get('/track',async (req,res) => {
  const id = verifyTracking(req.get('x-tracking-key'))
  if (!id) throw problem(403,'A valid tracking link is required.')
  const record = await lookup(deliveryRecordId(id))
  if (!record.id) throw problem(404,'Delivery not found.')
  res.json(deliveryPublic(record))
})
app.post('/deliveries/:deliveryId',async (req,res) => {
  requireRole(req,deliveryRoles)
  const id = req.params.deliveryId
  if (!/^[0-9a-f-]{36}$/.test(id)) throw problem(404,'Delivery not found.')
  const {status,driver,latitude,longitude} = req.body || {}
  const {role,username} = req.account
  const record = await update(deliveryRecordId(id),state => {
    if (!state.id || (role === 'delivery' && state.driver !== username)) throw problem(404,'Delivery not found.')
    if (driver !== undefined) {
      requireRole(req,dispatchRoles)
      if (!drivers().includes(driver) || !['Placed','Cooking','Ready'].includes(state.status)) throw problem(409,'Select an available driver before dispatch.')
      state.driver = driver
      return
    }
    if (latitude !== undefined || longitude !== undefined) {
      requireRole(req,['delivery'])
      if (state.status !== 'Out for delivery' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw problem(400,'Location is available while out for delivery.')
      state.location = {latitude:Number(latitude.toFixed(4)),longitude:Number(longitude.toFixed(4)),at:Date.now()}
      return
    }
    const allowed = {
      Cooking:['manager','kitchen'],Ready:['manager','kitchen'],
      'Out for delivery':['manager','delivery'],Delivered:['manager','delivery'],Cancelled:dispatchRoles,
    }
    if (!Object.hasOwn(allowed,status)) throw problem(400,'Choose a valid delivery stage.')
    requireRole(req,allowed[status])
    const valid = status === 'Cancelled' ? state.status === 'Placed'
      : deliveryStates.indexOf(status) === deliveryStates.indexOf(state.status) + 1
    if (!valid || (status === 'Out for delivery' && !state.driver)) throw problem(409,'That delivery cannot advance yet.')
    state.status = status
    state.events.push({status,at:Date.now()})
    if (status === 'Delivered') delete state.location
  })
  res.json(deliveryFor(record,role))
})
app.use((error, req, res, next) => {
  if (!error.status) console.error(error)
  res.status(error.status || 500).json({error:error.status && error.status < 500 ? error.message : 'Something went wrong.'})
})
export default app
