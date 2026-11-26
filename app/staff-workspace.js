'use client'

import { useState } from 'react'
import { BarChart3, BellRing, ChefHat, Clock3, Download, LayoutGrid, QrCode, Truck, UsersRound, Utensils } from 'lucide-react'
import DeliveryWorkspace from './delivery-workspace'
import { roles } from '../lib/roles'
import { menu } from '../lib/menu'
import { orderSubtotal, paidTotal, parisDay, serviceReasons, tableBalance, tipTotal } from '../lib/operations'

const views = [
  ['floor','Floor',LayoutGrid], ['reception','Reception',UsersRound], ['kitchen','Kitchen',ChefHat], ['dispatch','Delivery',Truck], ['catalog','Menu',Utensils], ['reports','Reports',BarChart3],
]
const stages = ['Placed','Cooking','Ready']
const activeOrder = order => stages.includes(order.status)
const pendingCalls = table => table.calls.filter(call => !call.resolved)
const occupied = table => Boolean(table.seating) || table.orders.length > 0 || pendingCalls(table).length > 0
const tableName = id => 'Table ' + id.padStart(2, '0')
const elapsed = (start, now) => Math.max(0, Math.floor((now - start) / 1000))
const timeLabel = (start, now) => {
  const time = elapsed(start, now)
  return Math.floor(time / 60) + 'm ' + String(time % 60).padStart(2,'0') + 's'
}
const next = {Placed:'Cooking', Cooking:'Ready', Ready:'Served'}
const labels = {Placed:'Send to kitchen', Cooking:'Mark ready', Ready:'Mark served'}
const dateTime = new Intl.DateTimeFormat('fr-FR', {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Paris'})
const fields = ['table', 'closed_at', 'orders', 'cancelled', 'sales_eur', 'collected_eur', 'tips_eur', 'rating']

function exportVisits(visits) {
  const rows = visits.map(visit => [
    visit.table, new Date(visit.closedAt).toISOString(), visit.orders, visit.cancelled,
    (visit.sales / 100).toFixed(2), (visit.collected / 100).toFixed(2), (visit.tips / 100).toFixed(2), visit.rating ?? '',
  ].join(';'))
  const url = URL.createObjectURL(new Blob(['\uFEFF', fields.join(';'), '\r\n', rows.join('\r\n')], {type:'text/csv;charset=utf-8;'}))
  const link = document.createElement('a')
  link.href = url
  link.download = 'tablee-directe-service.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function OrderTicket({order, table, now, busy, perform, money, compact, payments, role}) {
  const late = order.status === 'Cooking' && elapsed(order.updatedAt, now) > 12 * 60
  const canAdvance = activeOrder(order) && (role === 'manager' || (role === 'kitchen' ? order.status !== 'Ready' : order.status !== 'Cooking'))
  return <article className={'ticket' + (late ? ' ticket-late' : '')}>
    <header><strong>{compact ? order.status : tableName(table)}</strong><span><Clock3 size={14}/> {timeLabel(order.updatedAt, now)}</span></header>
    <ul>{order.items.map(item => <li key={item.id}><b>{item.quantity}×</b> {item.name}</li>)}</ul>
    {order.note && <p className="ticket-note">{order.note}</p>}
    <footer><strong>{money(orderSubtotal(order))}</strong>
      {canAdvance && <button className="primary" disabled={busy} onClick={() => perform({action:'status',orderId:order.id,status:next[order.status]}, 'Order updated.', table)}>{labels[order.status]}</button>}
    </footer>
    {compact && order.status === 'Placed' && payments.length === 0 && <button className="text-danger" disabled={busy} onClick={() => {
      if (window.confirm('Cancel this order before it reaches the kitchen?')) perform({action:'status',orderId:order.id,status:'Cancelled'}, 'Order cancelled.', table)
    }}>Cancel order</button>}
  </article>
}

export default function StaffWorkspace({view,setView,tables,now,busy,perform,money,showQr,openPayment,signOut,unavailable,toggleDish,demo,account,live,openSeating,deliveryOrders,drivers,performDelivery,notify}) {
  const [filter,setFilter] = useState('All tables')
  const [reportDay,setReportDay] = useState('')
  const active = tables.filter(occupied)
  const orders = tables.flatMap(table => table.orders.map(order => ({table:table._id,order})))
  const calls = tables.reduce((sum, table) => sum + pendingCalls(table).length, 0)
  const balance = tables.reduce((sum, table) => sum + tableBalance(table), 0)
  const today = now ? parisDay(now) : ''
  const selectedDay = reportDay || today
  const history = tables.flatMap(table => (table.history || []).map(visit => ({...visit,table:table._id})))
  const visits = history.filter(visit => parisDay(visit.closedAt) === selectedDay)
    .sort((a,b) => b.closedAt - a.closedAt)
  const todayPayments = tables.flatMap(table => table.payments).filter(payment => parisDay(payment.createdAt) === selectedDay)
  const paymentsOnDay = history.map(visit => visit.paymentDays
    ? visit.paymentDays[selectedDay]
    : parisDay(visit.closedAt) === selectedDay ? visit : null).filter(Boolean)
  const collected = paymentsOnDay.reduce((sum, visit) => sum + visit.collected, paidTotal(todayPayments))
  const tips = paymentsOnDay.reduce((sum, visit) => sum + visit.tips, tipTotal(todayPayments))
  const ratings = visits.flatMap(visit => visit.rating ? [visit.rating] : [])
  const filtered = tables.filter(table => filter === 'All tables' || (filter === 'Active' && occupied(table)) ||
    (filter === 'Requests' && pendingCalls(table).length) || (filter === 'Unpaid' && tableBalance(table) > 0))

  return <section className="workspace">
    <header className="workspace-head"><div><p>{roles[account.role].label} · {account.username}</p><h1>Service dashboard</h1></div><span className="live-indicator">{demo ? 'Demo · ' : ''}{live ? 'Socket connected' : 'Connecting to live updates'}</span></header>
    <nav className="workspace-nav" aria-label="Staff views">
      {views.filter(([id]) => roles[account.role].views.includes(id)).map(([id,label,Icon]) => <button key={id} className={view === id ? 'is-current' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><Icon size={18}/>{label}</button>)}
      <button className="logout" onClick={signOut}>Sign out</button>
    </nav>
    {view === 'floor' && <>
      <div className="metrics">
        <div><span>Active tables</span><strong>{active.length}<small> / {tables.length}</small></strong></div>
        <div><span>Open orders</span><strong>{orders.filter(({order}) => activeOrder(order)).length}</strong></div>
        <div><span>Waiter requests</span><strong>{calls}</strong></div>
        <div><span>Outstanding</span><strong>{money(balance)}</strong></div>
      </div>
      <div className="workspace-title"><h2>Floor plan</h2><div className="filters">{['All tables','Active','Requests','Unpaid'].map(label => <button className={filter === label ? 'chosen' : ''} key={label} onClick={() => setFilter(label)}>{label}</button>)}</div></div>
      <div className="floor">
        {filtered.map(table => <article className="staff-card expanded-table" key={table._id}>
          <div className="staff-card-head"><div><h3>{tableName(table._id)}</h3><span className={'state-label ' + (occupied(table) ? 'occupied' : '')}>{occupied(table) ? 'In service' : 'Available'}</span></div><button className="icon-button" aria-label={'QR code for ' + tableName(table._id)} onClick={() => showQr(table._id)}><QrCode size={19}/></button></div>
          {pendingCalls(table).map(call => <div className="service-alert" key={call.id}><span><BellRing size={16}/> {serviceReasons[call.reason] || serviceReasons.help}</span><button disabled={busy} onClick={() => perform({action:'resolve',callId:call.id}, 'Request resolved.', table._id)}>Resolve</button></div>)}
          {table.orders.map(order => <OrderTicket key={order.id} {...{order,now,busy,perform,money}} compact role={account.role} table={table._id} payments={table.payments}/>)}
          {table.reviews?.map(review => <p key={review.id}>★ {review.rating}/5 {review.comment}</p>)}
          <div className="table-actions">
          {tableBalance(table) > 0 && <button className="primary" onClick={() => openPayment(table)}>Record {money(tableBalance(table))}</button>}
          {tableBalance(table) === 0 && (table.seating || table.orders.length > 0 || table.calls.length > 0) && !table.orders.some(activeOrder) && pendingCalls(table).length === 0 && <button onClick={() => perform({action:'close'}, 'Visit closed and added to reports.', table._id)} disabled={busy}>Close visit</button>}
          </div>
        </article>)}
        {filtered.length === 0 && <p className="empty-state">No tables match this filter.</p>}
      </div>
    </>}
    {view === 'reception' && <>
      <div className="workspace-title"><div><h2>Reception and seating</h2><p>Seat walk-ins, track covers, and give guests their table QR.</p></div></div>
      <div className="metrics"><div><span>Available tables</span><strong>{tables.length-active.length}</strong></div><div><span>Seated parties</span><strong>{tables.filter(table => table.seating).length}</strong></div><div><span>Guests seated</span><strong>{tables.reduce((count,table) => count + (table.seating?.party || 0),0)}</strong></div></div>
      <div className="floor">{tables.map(table => <article className="staff-card expanded-table" key={table._id}>
        <div className="staff-card-head"><h3>{tableName(table._id)}</h3><button className="icon-button" aria-label={'QR code for ' + tableName(table._id)} onClick={() => showQr(table._id)}><QrCode size={19}/></button></div>
        {table.seating && <p><strong>{table.seating.party} guests</strong>{table.seating.guestName && ' · ' + table.seating.guestName}</p>}
        {occupied(table) ? <p className="muted">In service</p> : <button disabled={busy} className="primary" onClick={() => openSeating(table)}>Seat party</button>}
      </article>)}</div>
    </>}
    {view === 'dispatch' && <DeliveryWorkspace role={account.role} orders={deliveryOrders} {...{drivers,money,busy,notify}} perform={performDelivery}/>}
    {view === 'kitchen' && <>
      <div className="workspace-title"><div><h2>Kitchen queue</h2><p>Orders are sorted oldest first. Cooking tickets are flagged after 12 minutes.</p></div></div>
      <div className="kanban">{stages.map(stage => {
        const tickets = orders.filter(({order}) => order.status === stage).sort((a,b) => a.order.updatedAt - b.order.updatedAt)
        return <section className="kanban-column" key={stage}><header><h3>{stage === 'Placed' ? 'New orders' : stage}</h3><span>{tickets.length}</span></header>
          {tickets.map(({order,table}) => <OrderTicket key={order.id} {...{order,table,now,busy,perform,money}} role={account.role}/>)}
          {tickets.length === 0 && <p className="empty-state">No orders</p>}
        </section>
      })}</div>
    </>}
    {view === 'catalog' && <>
      <div className="workspace-title"><div><h2>Menu availability</h2><p>Sold-out dishes stay visible and can’t be added to new orders.</p></div></div>
      <div className="catalog">{menu.map(dish => {
        const soldOut = unavailable.includes(dish.id)
        return <article key={dish.id}><img src={dish.image} alt="" /><div><h3>{dish.name}</h3><p>{dish.category} · {money(dish.price)}</p></div><button role="switch" aria-label={dish.name + ' availability'} aria-checked={!soldOut} disabled={busy} onClick={() => toggleDish(dish.id,soldOut)}>{soldOut ? 'Sold out' : 'Available'}</button></article>
      })}</div>
    </>}
    {view === 'reports' && <>
      <div className="workspace-title"><div><h2>Service report</h2><p>Closed visits and payments on open tables, grouped by Paris date.</p></div><div className="report-controls"><input type="date" aria-label="Reporting day" value={selectedDay} onChange={event => setReportDay(event.target.value)}/><button disabled={!visits.length} onClick={() => exportVisits(visits)}><Download size={17}/> Closed visits CSV</button></div></div>
      <div className="metrics">
        <div><span>Closed visits</span><strong>{visits.length}</strong></div>
        <div><span>Collected</span><strong>{money(collected)}</strong></div>
        <div><span>Tips</span><strong>{money(tips)}</strong></div>
        <div><span>Guest rating</span><strong>{ratings.length ? (ratings.reduce((sum,rating) => sum + rating,0) / ratings.length).toFixed(1) + ' / 5' : '—'}</strong></div>
      </div>
      <div className="report-table"><table><thead><tr><th>Table</th><th>Closed at</th><th>Orders</th><th>Cancelled</th><th>Collected</th><th>Tips</th><th>Rating</th></tr></thead><tbody>
      {visits.map(visit => <tr key={visit.id}><td>{tableName(visit.table)}</td><td>{dateTime.format(visit.closedAt)}</td><td>{visit.orders}</td><td>{visit.cancelled}</td><td>{money(visit.collected)}</td><td>{money(visit.tips)}</td><td>{visit.rating || '—'}</td></tr>)}
      {!visits.length && <tr><td colSpan="7">No closed visits for this date.</td></tr>}
      </tbody></table></div>
    </>}
  </section>
}
