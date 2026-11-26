import { createHmac } from 'node:crypto'
import { demo, equal, sessionFromCookie, verifyTracking } from './auth.js'
import { changes, startChangeFeed } from './changes.js'

export const tableIds = Array.from({length:12}, (_, i) => String(i + 1))
export const tableKey = id => demo && !process.env.TABLE_KEY ? '' : createHmac('sha256',process.env.TABLE_KEY || '').update(id).digest('hex')
export function canAccessTable(table,key) {
  return tableIds.includes(table) && Boolean(demo || process.env.TABLE_KEY) && equal(key || '',tableKey(table))
}
const tableRoles = ['manager','reception','floor','kitchen']
export function subscribe({cookie, table, key, tracking, notify, terminate}) {
  const account = sessionFromCookie(cookie)
  const guest = canAccessTable(table,key)
  const trackingId = verifyTracking(tracking)
  const deliveryId = trackingId ? 'delivery-' + trackingId : ''
  if (!account && !guest && !deliveryId) return null
  startChangeFeed()
  const update = id => {
    if (id === 'menu-settings' || (guest && id === table) ||
      (account && tableRoles.includes(account.role) && tableIds.includes(id)) ||
      (id.startsWith('delivery-') && account && ['manager','reception','kitchen','delivery'].includes(account.role)) ||
      (deliveryId && id === deliveryId)) notify()
  }
  changes.on('change',update)
  // Revalidate over HTTP after reconnections and where demo instances do not share state.
  const heartbeat = setInterval(notify, demo ? 3500 : 30000)
  const expiry = account ? setTimeout(terminate, Math.max(0,account.exp*1000-Date.now())) : null
  return () => {changes.off('change',update);clearInterval(heartbeat);clearTimeout(expiry)}
}

export function attachSocket(ws,cookie) {
  let stop
  let subscribed = false
  const deadline = setTimeout(() => {if (!subscribed) ws.close(1008,'Subscription required')},5000)
  ws.on('message', raw => {
    if (subscribed) return
    try {
      const value = raw.toString()
      if (value.length > 1024) return ws.close(1008,'Invalid subscription')
      const {table,key,tracking} = JSON.parse(value)
      const notify = () => {try {ws.send('change')} catch {}}
      stop = subscribe({cookie,table,key,tracking,notify,terminate:() => ws.close(1008,'Session expired')})
      if (!stop) return ws.close(1008,'Unauthorized')
      subscribed = true
      clearTimeout(deadline)
      ws.send('ready')
    } catch {ws.close(1008,'Invalid subscription')}
  })
  ws.on('close',() => {clearTimeout(deadline);stop?.()})
}
