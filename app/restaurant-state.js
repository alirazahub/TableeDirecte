export const initialRestaurantState = {
  guest: null,
  tables: [],
  unavailable: [],
  deliveries: [],
  drivers: [],
  tracking: null,
  connection: '',
}

function newer(current, incoming) {
  return current && incoming.version < current.version ? current : incoming
}

export function restaurantReducer(state, message) {
  switch (message.type) {
    case 'snapshot':
      return {
        ...state,
        guest: message.guest || state.guest,
        tables: message.tables || state.tables,
        unavailable: message.unavailable || state.unavailable,
        deliveries: message.deliveries?.orders || state.deliveries,
        drivers: message.deliveries?.drivers || state.drivers,
        tracking: Object.hasOwn(message, 'tracking') ? message.tracking : state.tracking,
        connection: message.message || '',
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
    case 'menu':
      return { ...state, unavailable: message.unavailable }
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
      return { ...state, tables: [], deliveries: [], drivers: [] }
    case 'error':
      return { ...state, connection: message.message }
    default:
      return state
  }
}
