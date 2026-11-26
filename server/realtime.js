import { createHmac } from 'node:crypto'
import { demo, equal, sessionFromCookie, verifyTracking } from './auth.js'
import { changes, startChangeFeed } from './changes.js'
import {
  configured,
  deliveryFor,
  deliveryPublic,
  deliveryRecordId,
  empty,
  floorLayoutId,
  floorProjection,
  readFloor,
  guestData,
  lookup,
  menuProjection,
  readMenu,
  staffDeliveries,
  staffTable,
  staffTables,
  tableIds,
  tableRoles,
} from './store.js'
import { roles } from '../lib/roles.js'

export const tableKey = (id) =>
  demo && !process.env.TABLE_KEY
    ? ''
    : createHmac('sha256', process.env.TABLE_KEY || '')
        .update(id)
        .digest('hex')
export function canAccessTable(table, key) {
  return (
    tableIds.includes(table) && Boolean(demo || process.env.TABLE_KEY) && equal(key || '', tableKey(table))
  )
}

function subscribe({ cookie, scope, send, terminate }) {
  if (!demo && !configured) {
    send({ type: 'error', message: 'Restaurant service has not been configured.' })
    terminate(1011, 'Service unavailable')
    return
  }
  const account = scope.staff ? sessionFromCookie(cookie) : null
  const { view, table, key, tracking } = scope
  if (scope.staff && (!account || (view && !roles[account.role].views.includes(view)))) {
    send({ type: 'error', message: 'Please sign in again.', authentication: !account })
    terminate(1008, 'Staff scope denied')
    return
  }
  const guest = !scope.staff && canAccessTable(table, key)
  const trackingId = !scope.staff && verifyTracking(tracking)
  const deliveryId = trackingId ? deliveryRecordId(trackingId) : ''
  const staffTableScope = Boolean(
    account &&
    tableRoles.includes(account.role) &&
    (!view || ['floor', 'reception', 'kitchen', 'reports'].includes(view)),
  )
  const staffDeliveryScope = Boolean(
    account && roles[account.role].views.includes('dispatch') && (!view || view === 'dispatch'),
  )
  const menuScope =
    !scope.staff || (roles[account.role].views.includes('catalog') && (!view || view === 'catalog'))
  let closed = false
  const queued = new Map()
  const visibleDeliveries = new Set()
  let initialized = false

  function publish(id, record) {
    if (staffTableScope && id === floorLayoutId)
      send({ type: 'floor-layout', layout: floorProjection(record) })
    if (id === 'menu-settings' && menuScope)
      send({ type: 'menu', ...menuProjection(record, account?.role === 'manager') })
    if (guest && id === table) send({ type: 'guest', table: guestData(record || empty(id)) })
    if (staffTableScope && tableIds.includes(id))
      send({ type: 'table', table: staffTable(record || empty(id), account.role) })
    if (deliveryId === id) send({ type: 'tracking', order: record?.id ? deliveryPublic(record) : null })
    if (staffDeliveryScope && id.startsWith('delivery-')) {
      const visible = record?.id && (account.role !== 'delivery' || record.driver === account.username)
      const orderId = id.slice(9)
      if (visible) {
        visibleDeliveries.add(orderId)
        send({ type: 'delivery', order: deliveryFor(record, account.role) })
      } else if (visibleDeliveries.delete(orderId)) {
        send({ type: 'delivery-hidden', id: orderId, version: record?.version })
      }
    }
  }
  function onChange(id, record) {
    if (initialized) publish(id, record)
    else queued.set(id, record)
  }

  const feedFailed = () => terminate(1012, 'Live database feed interrupted')
  changes.on('change', onChange)
  changes.on('feed-error', feedFailed)
  const expiry = account
    ? setTimeout(
        () => {
          send({ type: 'error', message: 'Please sign in again.', authentication: true })
          terminate(1008, 'Session expired')
        },
        Math.max(0, account.exp * 1000 - Date.now()),
      )
    : null
  const stop = () => {
    closed = true
    clearTimeout(expiry)
    changes.off('change', onChange)
    changes.off('feed-error', feedFailed)
    queued.clear()
  }

  startChangeFeed()
    .then(() =>
      Promise.all([
        guest ? lookup(table) : null,
        staffTableScope ? staffTables(account.role) : null,
        staffDeliveryScope ? staffDeliveries(account) : null,
        menuScope ? readMenu(account?.role === 'manager') : null,
        staffTableScope ? readFloor() : null,
        deliveryId ? lookup(deliveryId) : null,
      ]),
    )
    .then(([record, tables, deliveries, catalog, layout, tracked]) => {
      if (closed) return
      for (const order of deliveries?.orders || []) visibleDeliveries.add(order.id)
      send({
        type: 'snapshot',
        guest: record ? guestData(record) : undefined,
        tables: tables || undefined,
        deliveries: deliveries || undefined,
        catalog: catalog || undefined,
        floorLayout: layout || undefined,
        tracking: deliveryId ? (tracked?.id ? deliveryPublic(tracked) : null) : undefined,
        message:
          !scope.staff && !guest && !deliveryId ? 'Scan the QR code on your table to order.' : undefined,
      })
      initialized = true
      for (const [id, data] of queued) publish(id, data)
      queued.clear()
    })
    .catch(() => terminate(1011, 'Could not load live data'))
  return stop
}

export function attachSocket(ws, cookie) {
  let stop
  let subscribed = false
  const deadline = setTimeout(() => {
    if (!subscribed) ws.close(1008, 'Subscription required')
  }, 5000)
  ws.on('message', (raw) => {
    if (subscribed) return
    try {
      const value = raw.toString()
      if (value.length > 1024) return ws.close(1008, 'Invalid subscription')
      const scope = JSON.parse(value)
      if (!scope || Array.isArray(scope) || typeof scope !== 'object')
        return ws.close(1008, 'Invalid subscription')
      const send = (payload) => {
        if (ws.readyState !== 1) return
        if (ws.bufferedAmount > 1024 * 1024) return ws.close(1013, 'Reconnect to resync')
        ws.send(JSON.stringify(payload))
      }
      stop = subscribe({ cookie, scope, send, terminate: (code, reason) => ws.close(code, reason) })
      if (!stop) return
      subscribed = true
      clearTimeout(deadline)
    } catch {
      ws.close(1008, 'Invalid subscription')
    }
  })
  ws.on('close', () => {
    clearTimeout(deadline)
    stop?.()
  })
}
