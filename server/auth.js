import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { roles, demoAccounts } from '../lib/roles.js'

export const demo = process.env.DEMO_MODE === 'true'
const configuredSecret = process.env.AUTH_SECRET
const secret = configuredSecret || (demo ? randomBytes(48).toString('hex') : '')
export const sessionCookie = 'tablee_session'
export const duration = 8 * 60 * 60
export const equal = (left,right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a,b)
}

const accounts = JSON.parse(process.env.STAFF_ACCOUNTS_JSON || '{}')
export const identityConfigured = Boolean(configuredSecret?.length >= 32 && Object.values(accounts).some(account => account.role === 'manager'))
export function drivers() {
  if (demo) return ['delivery']
  return Object.keys(accounts).filter(name => accounts[name].role === 'delivery').sort()
}
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + scryptSync(password,salt,64).toString('hex')
}
export function authenticate(username,password) {
  if (typeof username !== 'string' || !/^[a-z0-9_.-]{2,48}$/.test(username) || typeof password !== 'string' || password.length > 200) return null
  if (demo) return demoAccounts.some(([name,code]) => equal(username,name) && equal(password,code))
    ? {username,role:username} : null
  if (!identityConfigured) return null
  const account = Object.hasOwn(accounts,username) ? accounts[username] : null
  const salt = account?.passwordHash?.split(':')[0] || 'invalid-account'
  const matches = equal(hashPassword(password,salt),account?.passwordHash)
  return matches && Object.hasOwn(roles,account.role) ? {username,role:account.role} : null
}
const sign = payload => createHmac('sha256',secret).update(payload).digest('base64url')
export function issueSession(account) {
  const fingerprint = demo ? '' : sign(accounts[account.username].passwordHash).slice(0,16)
  const payload = Buffer.from(JSON.stringify({...account,fingerprint,exp:Math.floor(Date.now()/1000)+duration})).toString('base64url')
  return payload + '.' + sign(payload)
}
export function sessionFromCookie(cookie = '') {
  if (!secret) return null
  const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1)
  if (!token || token.length > 800) return null
  const [payload,signature,extra] = token.split('.')
  if (extra || !equal(signature,sign(payload))) return null
  try {
    const session = JSON.parse(Buffer.from(payload,'base64url'))
    if (session.exp <= Date.now()/1000 || !Object.hasOwn(roles,session.role)) return null
    if (demo && (session.username !== session.role || !demoAccounts.some(([name]) => name === session.username))) return null
    if (!demo) {
      const account = Object.hasOwn(accounts,session.username) ? accounts[session.username] : null
      if (!account || account.role !== session.role || !equal(session.fingerprint,sign(account.passwordHash).slice(0,16))) return null
    }
    return session
  } catch {return null}
}

export function trackingKey(id) {
  return id + '.' + sign('delivery:' + id)
}

export function verifyTracking(token) {
  if (!secret || typeof token !== 'string' || !/^[\w-]{36}\.[\w-]{43}$/.test(token)) return null
  const id = token.split('.')[0]
  return equal(token,trackingKey(id)) ? id : null
}

export const customerCookie = 'tablee_customer'
export function issueCustomer(username) {
  const payload = Buffer.from(JSON.stringify({username,exp:Math.floor(Date.now()/1000)+duration})).toString('base64url')
  return payload + '.' + sign('customer:' + payload)
}
export function customerFromCookie(cookie = '') {
  if (!secret) return null
  const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(customerCookie + '='))?.slice(customerCookie.length + 1)
  if (!token || token.length > 500) return null
  const [payload,signature,extra] = token.split('.')
  if (extra || !equal(signature,sign('customer:' + payload))) return null
  try {
    const account = JSON.parse(Buffer.from(payload,'base64url'))
    return account.exp > Date.now()/1000 && /^[a-z0-9_.-]{3,36}$/.test(account.username) ? account : null
  } catch {return null}
}
