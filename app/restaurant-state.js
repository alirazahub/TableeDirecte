import { menu } from '../lib/menu.js'
import { notificationEvents } from './notification-events.js'

export const initialRestaurantState = {
  guest: null,
  tables: [],
  floorLayout: null,
  unavailable: [],
  dishes: menu,
  menuVersion: -1,
  deliveries: [],
  drivers: [],
  tracking: null,
  connection: '',
  notifications: [],
  notificationSequence: 0,
}

function newer(current, incoming) {
  return current && incoming.version < current.version ? current : incoming
}

function reduceData(state, message) {
  switch (message.type) {
    case 'snapshot': {
      const catalog = message.catalog?.version >= state.menuVersion ? message.catalog : null
      return {
        ...state,
        guest: message.guest || state.guest,
        tables: message.tables || state.tables,
        floorLayout: message.floorLayout ? newer(state.floorLayout, message.floorLayout) : state.floorLayout,
        unavailable: catalog?.unavailable || message.unavailable || state.unavailable,
        dishes: catalog?.dishes || state.dishes,
        menuVersion: catalog?.version ?? state.menuVersion,
        deliveries: message.deliveries?.orders || state.deliveries,
        drivers: message.deliveries?.drivers || state.drivers,
        tracking: Object.hasOwn(message, 'tracking') ? message.tracking : state.tracking,
        connection: message.message || '',
      }
    }
    case 'guest':
      return { ...state, guest: newer(state.guest, message.table) }
    case 'table':
      return {
        ...state,
        tables: state.tables.map((table) =>
          table._id === message.table._id ? newer(table, message.table) : table,
        ),
      }
    case 'floor-layout':
      return { ...state, floorLayout: newer(state.floorLayout, message.layout) }
    case 'menu':
      return Number.isInteger(message.version) && message.version < state.menuVersion
        ? state
        : {
            ...state,
            unavailable: message.unavailable,
            dishes: message.dishes || state.dishes,
            menuVersion: message.version ?? state.menuVersion,
          }
    case 'tracking': {
      const order = message.order
      return {
        ...state,
        tracking: order && state.tracking?.id === order.id ? newer(state.tracking, order) : order,
      }
    }
    case 'delivery': {
      const order = message.order
      const known = state.deliveries.some((item) => item.id === order.id)
      const deliveries = known
        ? state.deliveries.map((item) => (item.id === order.id ? newer(item, order) : item))
        : [...state.deliveries, order].sort((a, b) => b.createdAt - a.createdAt).slice(0, 150)
      return { ...state, deliveries }
    }
    case 'delivery-hidden':
      return {
        ...state,
        deliveries: state.deliveries.filter(
          (item) => item.id !== message.id || item.version > message.version,
        ),
      }
    case 'clear-staff':
      return {
        ...state,
        tables: [],
        floorLayout: null,
        deliveries: [],
        drivers: [],
        dishes: state.dishes.filter((dish) => !dish.archived),
      }
    case 'error':
      return { ...state, connection: message.message }
    default:
      return state
  }
}

export function restaurantReducer(state, message) {
  if (message.type === 'dismiss-notification') {
    return { ...state, notifications: state.notifications.filter((item) => item.id !== message.id) }
  }
  if (message.type === 'dismiss-notifications') {
    return { ...state, notifications: state.notifications.filter((item) => item.scope !== message.scope) }
  }
  if (message.type === 'clear-staff') {
    return {
      ...reduceData(state, message),
      notifications: state.notifications.filter((item) => !item.scope.startsWith('staff:')),
    }
  }
  const next = reduceData(state, message)
  if (!message.notify || next === state) return next
  const events = notificationEvents(state, message)
  if (!events.length) return next
  const newItems = events.map((event, index) => ({
    ...event,
    id: state.notificationSequence + index + 1,
    scope: message.scope,
    at: message.at,
  }))
  return {
    ...next,
    notificationSequence: state.notificationSequence + events.length,
    notifications: [...newItems.reverse(), ...state.notifications].slice(0, 40),
  }
}
