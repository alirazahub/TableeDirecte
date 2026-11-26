export const serviceReasons = {
  help:'Assistance',
  water:'Water',
  cutlery:'Cutlery',
  bill:'Bill / payment',
}
export const orderStates = ['Placed', 'Cooking', 'Ready', 'Served', 'Cancelled']
export const lineTotal = items => items.reduce((sum, item) => sum + item.price * item.quantity, 0)
export const orderSubtotal = order => order.status === 'Cancelled' ? 0 : lineTotal(order.items)
export const subtotal = orders => orders.reduce((sum, order) => sum + orderSubtotal(order), 0)
export const paidTotal = payments => payments.reduce((sum, payment) => sum + payment.amount, 0)
export const tipTotal = payments => payments.reduce((sum, payment) => sum + payment.tip, 0)
export const tableBalance = table => table ? subtotal(table.orders) - paidTotal(table.payments) : 0

export function parisDay(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit',
  }).formatToParts(timestamp)
  const date = Object.fromEntries(parts.map(({type,value}) => [type,value]))
  return [date.year,date.month,date.day].join('-')
}
