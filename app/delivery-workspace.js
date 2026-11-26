'use client'

import { Clock3, MapPin, Truck } from 'lucide-react'

const timeline = ['Placed', 'Cooking', 'Ready', 'Out for delivery', 'Delivered']
const time = (value) =>
  new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: 'Europe/Paris' }).format(value)
const next = {
  Placed: 'Cooking',
  Cooking: 'Ready',
  Ready: 'Out for delivery',
  'Out for delivery': 'Delivered',
}

export function DeliveryProgress({ order, money }) {
  return (
    <div className="delivery-progress">
      <div className="bill-line">
        <strong>{order.status}</strong>
        <strong>{money(order.total)}</strong>
      </div>
      <ol>
        {(order.status === 'Cancelled' ? ['Placed', 'Cancelled'] : timeline).map((status) => {
          const event = order.events.find((entry) => entry.status === status)
          return (
            <li className={event ? 'completed' : ''} key={status}>
              <span>{status}</span>
              {event && (
                <time>
                  <Clock3 size={13} /> {time(event.at)}
                </time>
              )}
            </li>
          )
        })}
      </ol>
      {order.location && (
        <a
          target="_blank"
          rel="noreferrer"
          href={
            'https://www.openstreetmap.org/?mlat=' +
            order.location.latitude +
            '&mlon=' +
            order.location.longitude +
            '#map=15/' +
            order.location.latitude +
            '/' +
            order.location.longitude
          }
        >
          <MapPin size={16} /> Courier location · {time(order.location.at)}
        </a>
      )}
    </div>
  )
}

export default function DeliveryWorkspace({ role, orders, drivers, perform, money, busy, notify }) {
  function shareLocation(id) {
    if (!navigator.geolocation) return notify('Location is unavailable on this device.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        perform(id, { latitude: coords.latitude, longitude: coords.longitude })
      },
      () => notify('Location wasn’t shared.'),
      { timeout: 8000, maximumAge: 10000 },
    )
  }
  return (
    <>
      <div className="workspace-title">
        <h2>{role === 'delivery' ? 'My assigned stops' : 'Delivery orders'}</h2>
        <span className="menu-count">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </span>
      </div>
      <div className="floor">
        {orders.length === 0 && <p className="empty-state">No deliveries to show.</p>}
        {orders.map((order) => {
          const nextStatus = next[order.status]
          const canAdvance =
            (['Cooking', 'Ready'].includes(nextStatus) && ['manager', 'kitchen'].includes(role)) ||
            (['Out for delivery', 'Delivered'].includes(nextStatus) && ['manager', 'delivery'].includes(role))
          return (
            <article className="staff-card delivery-card" key={order.id}>
              <div className="staff-card-head">
                <h3>
                  <Truck size={18} /> {order.id.slice(0, 8).toUpperCase()}
                </h3>
                <strong>{money(order.total)}</strong>
              </div>
              {order.recipient && (
                <>
                  <p>
                    <strong>{order.recipient}</strong>
                  </p>
                  <p>{order.address}</p>
                  <a href={'tel:' + order.phone}>{order.phone}</a>
                </>
              )}
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.name}
                  </li>
                ))}
              </ul>
              {order.note && <p className="ticket-note">{order.note}</p>}
              <DeliveryProgress order={order} money={money} />
              {drivers.length > 0 && timeline.indexOf(order.status) < 3 && order.status !== 'Cancelled' && (
                <label className="driver-select">
                  Assigned driver
                  <select
                    value={order.driver || ''}
                    disabled={busy}
                    onChange={(event) => perform(order.id, { driver: event.target.value })}
                  >
                    <option value="" disabled>
                      Select a driver
                    </option>
                    {drivers.map((driver) => (
                      <option key={driver}>{driver}</option>
                    ))}
                  </select>
                </label>
              )}
              {canAdvance && (
                <button
                  className="primary"
                  disabled={busy || (nextStatus === 'Out for delivery' && !order.driver)}
                  onClick={() => perform(order.id, { status: nextStatus })}
                >
                  {nextStatus === 'Out for delivery' ? 'Start delivery' : 'Mark ' + nextStatus.toLowerCase()}
                </button>
              )}
              {['manager', 'reception'].includes(role) && order.status === 'Placed' && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Cancel this delivery order?'))
                      perform(order.id, { status: 'Cancelled' })
                  }}
                >
                  Cancel delivery
                </button>
              )}
              {role === 'delivery' && order.status === 'Out for delivery' && (
                <button disabled={busy} onClick={() => shareLocation(order.id)}>
                  <MapPin size={16} /> Share current location
                </button>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}
