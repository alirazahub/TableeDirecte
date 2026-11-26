import { serviceReasons } from '../lib/operations.js'
import { money } from './restaurant-api.js'

const tableStatus = {
  Placed: 'Order placed',
  Cooking: 'Sent to kitchen',
  Ready: 'Order ready',
  Served: 'Order completed',
  Cancelled: 'Order cancelled',
}

const deliveryStatus = {
  Placed: 'Delivery order placed',
  Cooking: 'Delivery sent to kitchen',
  Ready: 'Delivery ready for pickup',
  'Out for delivery': 'Out for delivery',
  Delivered: 'Delivery completed',
  Cancelled: 'Delivery cancelled',
}

function addedRecords(previous, current) {
  const seen = new Set(previous.map((item) => item.id))
  return current.filter((item) => !seen.has(item.id))
}

function tableEvents(previous, current) {
  if (!current || (previous && current.version <= previous.version)) return []
  const label = 'Table ' + current._id.padStart(2, '0')
  const events = []
  const add = (title, detail, kind = 'table') =>
    events.push({ title, detail: detail ? label + ' · ' + detail : label, kind })
  const olderOrders = new Map((previous?.orders || []).map((order) => [order.id, order]))

  for (const order of current.orders) {
    const prior = olderOrders.get(order.id)
    if (tableStatus[order.status] && prior?.status !== order.status) {
      const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
      add(
        tableStatus[order.status],
        quantity + (quantity === 1 ? ' item' : ' items'),
        order.status === 'Ready' ? 'ready' : 'order',
      )
    }
  }

  const calls = new Map((previous?.calls || []).map((call) => [call.id, call]))
  for (const call of current.calls) {
    if (!calls.has(call.id) && !call.resolved)
      add('Waiter requested', serviceReasons[call.reason] || serviceReasons.help, 'service')
    if (calls.get(call.id)?.resolved === false && call.resolved)
      add('Waiter request resolved', serviceReasons[call.reason] || serviceReasons.help, 'service')
  }
  for (const payment of addedRecords(previous?.payments || [], current.payments)) {
    add('Payment recorded', money(payment.amount + payment.tip), 'payment')
  }
  for (const review of addedRecords(previous?.reviews || [], current.reviews || [])) {
    add('Guest review received', review.rating + ' / 5', 'service')
  }

  if (!previous?.seating && current.seating) add('Party seated', current.seating.party + ' guests')
  const occupied = (table) =>
    table.seating || table.orders.length || table.payments.length || table.calls.length
  if (previous && occupied(previous) && !occupied(current)) add('Visit closed', '')
  return events
}

function deliveryEvents(previous, current, role) {
  if (!current || (previous && current.version <= previous.version)) return []
  const detail = 'Delivery ' + current.id.slice(-4).toUpperCase()
  const events = []
  if (role === 'delivery' && !previous)
    return [{ title: 'Delivery assigned to you', detail, kind: 'delivery' }]
  if (current.driver && current.driver !== previous?.driver) {
    events.push({ title: 'Driver assigned', detail: detail + ' · ' + current.driver, kind: 'delivery' })
  }
  if (current.status !== previous?.status && deliveryStatus[current.status]) {
    events.push({
      title: deliveryStatus[current.status],
      detail,
      kind: current.status === 'Ready' ? 'ready' : 'delivery',
    })
  }
  return events
}

export function notificationEvents(state, message) {
  switch (message.type) {
    case 'guest':
      return tableEvents(state.guest, message.table)
    case 'table':
      return tableEvents(
        state.tables.find((table) => table._id === message.table._id),
        message.table,
      )
    case 'delivery':
      return deliveryEvents(
        state.deliveries.find((order) => order.id === message.order.id),
        message.order,
        message.role,
      )
    case 'delivery-placed':
      return deliveryEvents(null, message.order)
    case 'tracking':
      return state.tracking?.id === message.order?.id ? deliveryEvents(state.tracking, message.order) : []
    case 'menu':
      if (!message.role) return []
      return (message.dishes || state.dishes)
        .filter((dish) => state.unavailable.includes(dish.id) !== message.unavailable.includes(dish.id))
        .map((dish) => ({
          title: message.unavailable.includes(dish.id) ? 'Dish sold out' : 'Dish available again',
          detail: dish.name,
          kind: 'service',
        }))
    default:
      return []
  }
}
