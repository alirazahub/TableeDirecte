import { paidTotal, subtotal, tableBalance, tipTotal } from '../lib/operations.js'

const date = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})
const methods = { cash: 'Cash', card: 'Card terminal', voucher: 'Voucher', demo: 'Demo payment' }
const tableName = (id) => 'Table ' + String(id).padStart(2, '0')
const timestamp = (time) => (Number.isFinite(time) ? date.format(time) : 'Not recorded')
const label = (name, value) => ({ name, value })
const amount = (name, cents, emphasis = false) => ({ name, cents, emphasis })
const lines = (order, showPrices = true) =>
  order.items.map((item, index) => ({
    key: order.id + ':' + (item.lineId || item.id || index),
    name: item.name,
    quantity: item.quantity,
    options: item.options?.map((choice) => choice.name) || [],
    note: item.note,
    ...(showPrices ? { cents: item.price * item.quantity } : {}),
  }))

export function billDocument(visit, now) {
  const orders = visit.orders.filter((order) => order.status !== 'Cancelled')
  const paid = paidTotal(visit.payments)
  const tips = tipTotal(visit.payments)
  const due = tableBalance(visit)
  return {
    title: 'Table bill',
    reference: label('Table', tableName(visit._id)),
    details: [
      label('Printed', timestamp(now)),
      label('Status', due ? (paid ? 'Part paid' : 'Payment due') : 'Settled'),
    ],
    items: orders.flatMap((order) => lines(order)),
    totals: [
      amount('Items subtotal', subtotal(orders)),
      amount('Paid toward bill', paid),
      ...(tips ? [amount('Tips paid', tips)] : []),
      amount('Balance due', due, true),
    ],
  }
}

export function paymentDocument(visit, payment) {
  return {
    title: 'Payment receipt',
    reference: label('Receipt reference', payment.id),
    details: [
      label('Table', tableName(visit._id)),
      label('Payment recorded', timestamp(payment.createdAt)),
      label('Method', methods[payment.method] || 'Not recorded'),
    ],
    totals: [
      amount('Applied to bill', payment.amount),
      amount('Tip', payment.tip),
      amount('Amount received', payment.amount + payment.tip, true),
    ],
    footer:
      payment.method === 'demo' ? 'Demo payment. No funds were collected.' : 'Thank you for your visit.',
  }
}

export function deliveryDocument(order, staff = false) {
  const cancelled = order.status === 'Cancelled'
  return {
    title: staff ? 'Delivery slip' : 'Delivery order receipt',
    reference: label('Order reference', order.id),
    details: [
      label('Placed', timestamp(order.createdAt)),
      label('Delivery status', order.status),
      ...(staff && order.recipient
        ? [label('Recipient', order.recipient), label('Delivery address', order.address)]
        : []),
    ],
    items: lines(order),
    totals: [amount('Order total', order.total, true)],
    footer: cancelled
      ? 'Cancelled order. No payment due.'
      : 'Payment on delivery. This document does not confirm payment.',
    note: staff ? order.note : undefined,
  }
}

export function kitchenDocument(order, table) {
  return {
    title: 'Kitchen ticket',
    reference: label('Order reference', order.id),
    details: [
      label('Table', tableName(table)),
      label('Placed', timestamp(order.createdAt)),
      label('Status', order.status),
    ],
    items: lines(order, false),
    note: order.note,
  }
}

export function closedVisitDocument(visit) {
  return {
    title: 'Closed visit summary',
    reference: label('Visit reference', visit.id),
    details: [
      label('Table', tableName(visit.table)),
      label('Closed', timestamp(visit.closedAt)),
      label('Completed orders', String(visit.orders)),
      label('Cancelled orders', String(visit.cancelled)),
    ],
    totals: [
      amount('Sales', visit.sales),
      amount('Collected toward bill', visit.collected),
      amount('Tips collected', visit.tips),
      amount('Total collected', visit.collected + visit.tips, true),
    ],
    footer: 'Summary of the closed visit.',
  }
}
