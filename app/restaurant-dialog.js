'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, Sparkles, Star, X } from 'lucide-react'
import { lineTotal as total, paidTotal, serviceReasons, tableBalance as balance } from '../lib/operations'
import { demoAccounts, demoCustomer, roles } from '../lib/roles'
import { DeliveryProgress } from './delivery-workspace'
import Dialog from './dialog'
import DishCustomizer from './dish-customizer'
import OrderLineOptions from './order-line-options'
import { money } from './restaurant-api'

export default function RestaurantDialog({
  panel,
  setPanel,
  dish,
  unavailable,
  menuVersion,
  editingLine,
  onCustomize,
  customer,
  customerOrders,
  customerAuth,
  customerSignOut,
  openTracking,
  signIn,
  perform,
  table,
  seatingTable,
  config,
  lines,
  busy,
  unavailableInCart,
  placeDelivery,
  tracked,
  setToast,
  toast,
  guest,
  checkout,
  staffMode,
  bill,
  qr,
}) {
  const [customerMode, setCustomerMode] = useState('signin')
  const [game, setGame] = useState([])
  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const points = Math.floor(paidTotal(guest?.payments || []) / 100)
  const labels = {
    dish: dish?.name,
    customer: 'Customer account',
    staff: 'Staff sign-in',
    seat: 'Seat party',
    delivery: 'Delivery details',
    tracking: 'Track your delivery',
    guide: 'How it works',
    service: 'Call waiter',
    wifi: 'Guest Wi-Fi',
    extras: 'Table perks',
    game: 'Memory match',
    qr: 'Table QR code',
    bill: 'Your bill',
    pay: 'Payment',
    review: 'Leave a review',
  }

  useEffect(() => {
    if (flipped.length !== 2) return
    const [first, second] = flipped
    const timeout = setTimeout(() => {
      if (game[first] === game[second]) setMatched((previous) => [...previous, first, second])
      setFlipped([])
    }, 650)
    return () => clearTimeout(timeout)
  }, [flipped, game])

  return (
    <Dialog label={labels[panel]} onClose={() => setPanel(null)}>
      {panel === 'dish' &&
        (dish && !dish.archived ? (
          <DishCustomizer
            key={dish.id + ':' + menuVersion + ':' + (editingLine?.key || '')}
            dish={dish}
            soldOut={unavailable.includes(dish.id)}
            onAdd={onCustomize}
            initial={editingLine}
          />
        ) : (
          <>
            <h2>Dish unavailable</h2>
            <p>This dish was removed from the menu.</p>
          </>
        ))}
      {panel === 'customer' &&
        (customer ? (
          <>
            <h2>My delivery orders</h2>
            <p>Signed in as {customer}</p>
            <div className="customer-orders">
              {customerOrders.map((order) => (
                <button key={order.id} onClick={() => openTracking(order.tracking, order)}>
                  <strong>{order.id.slice(0, 8).toUpperCase()}</strong> · {order.status} ·{' '}
                  {money(order.total)}
                </button>
              ))}
              {!customerOrders.length && <p>No delivery orders on this account.</p>}
            </div>
            <button onClick={customerSignOut}>Sign out</button>
          </>
        ) : (
          <form onSubmit={(event) => customerAuth(event, customerMode)}>
            <h2>{customerMode === 'register' ? 'Create an account' : 'Customer sign-in'}</h2>
            <p>
              Save delivery orders to your account. QR ordering still works for guests.
              {config.demo && ' Use a sample password in this demo.'}
            </p>
            {config.demo && customerMode === 'signin' && (
              <button
                type="button"
                onClick={(event) => {
                  const form = event.currentTarget.form
                  form.elements.username.value = demoCustomer.username
                  form.elements.password.value = demoCustomer.password
                }}
              >
                Fill demo customer sign-in
              </button>
            )}
            <label>
              Username
              <input name="username" pattern="[a-z0-9_.\-]{3,36}" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength="10"
                maxLength="200"
                autoComplete={customerMode === 'register' ? 'new-password' : 'current-password'}
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              {customerMode === 'register' ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode(customerMode === 'register' ? 'signin' : 'register')}
            >
              {customerMode === 'register' ? 'Use an existing account' : 'Create an account'}
            </button>
          </form>
        ))}
      {panel === 'staff' && (
        <form onSubmit={signIn}>
          <h2>Staff sign-in</h2>
          {config.demo && (
            <div className="demo-accounts">
              <p>Choose a demo role to fill its sign-in.</p>
              {demoAccounts.map(([role, password]) => (
                <button
                  key={role}
                  type="button"
                  onClick={(event) => {
                    const form = event.currentTarget.form
                    form.elements.username.value = role
                    form.elements.password.value = password
                  }}
                >
                  {roles[role].label} · {password}
                </button>
              ))}
            </div>
          )}
          <label>
            Account name
            <input autoFocus name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="primary" disabled={busy}>
            Sign in
          </button>
        </form>
      )}
      {panel === 'seat' && seatingTable && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const fields = new FormData(event.currentTarget)
            perform(
              { action: 'seat', party: Number(fields.get('party')), guestName: fields.get('guestName') },
              'Party seated.',
              seatingTable._id,
              () => setPanel(null),
            )
          }}
        >
          <h2>Seat table {seatingTable._id}</h2>
          <label>
            Party size
            <input name="party" type="number" min="1" max="24" defaultValue="2" required />
          </label>
          {!config.demo && (
            <label>
              Party name (optional)
              <input name="guestName" maxLength="60" />
            </label>
          )}
          <button disabled={busy} className="primary">
            Seat party
          </button>
        </form>
      )}
      {panel === 'delivery' && (
        <form onSubmit={placeDelivery}>
          <h2>Delivery details</h2>
          <p>
            {money(total(lines))} · Payment on delivery.
            {config.demo && ' The demo uses a sample recipient and address.'}
          </p>
          {!config.demo && (
            <>
              <label>
                Recipient
                <input name="recipient" maxLength="80" required />
              </label>
              <label>
                Delivery address
                <textarea name="address" maxLength="200" required />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" maxLength="30" required />
              </label>
            </>
          )}
          <button className="primary" disabled={busy || unavailableInCart || !lines.length}>
            Place delivery order
          </button>
        </form>
      )}
      {panel === 'tracking' && (
        <>
          <h2>Track your delivery</h2>
          {tracked ? (
            <DeliveryProgress order={tracked} money={money} />
          ) : (
            <p>Waiting for delivery details.</p>
          )}
          <button
            className="primary"
            onClick={() =>
              navigator.clipboard
                .writeText(location.href)
                .then(() => setToast('Tracking link copied.'))
                .catch(() => setToast('Copy the tracking link from your address bar.'))
            }
          >
            Copy private tracking link
          </button>
        </>
      )}
      {panel === 'guide' && (
        <>
          <h2>From table to kitchen</h2>
          <div className="feature-guide">
            <div>
              <strong>Scan and browse</strong>
              <p>Your table’s QR code opens the menu. Search dishes and check dietary details.</p>
            </div>
            <div>
              <strong>Send an order</strong>
              <p>Add dishes, leave kitchen notes, and follow each order as it’s prepared.</p>
            </div>
            <div>
              <strong>Get help at the table</strong>
              <p>Request water, cutlery, or assistance. Find Wi-Fi, points, and games in the guest menu.</p>
            </div>
            <div>
              <strong>Split the bill</strong>
              <p>Choose a share, add a tip, and leave a review after the bill is settled.</p>
            </div>
          </div>
        </>
      )}
      {panel === 'service' && (
        <>
          <h2>How can we help?</h2>
          <p>Send a request to your floor team.</p>
          <div className="service-options">
            {Object.entries(serviceReasons).map(([reason, label]) => {
              const pending = guest?.calls.some(
                (call) => !call.resolved && (call.reason || 'help') === reason,
              )
              return (
                <button
                  key={reason}
                  disabled={busy || pending}
                  onClick={() =>
                    perform({ action: 'call', reason }, 'Request sent to staff.', table, () => setPanel(null))
                  }
                >
                  {label}
                  {pending && ' · Requested'}
                </button>
              )
            })}
          </div>
        </>
      )}
      {panel === 'wifi' && (
        <>
          <h2>Guest Wi-Fi</h2>
          <p>
            Network <strong>{config.wifi || 'Unavailable'}</strong>
          </p>
          {config.wifiPassword && (
            <p>
              Password <strong>{config.wifiPassword}</strong>
            </p>
          )}
        </>
      )}
      {panel === 'extras' && (
        <>
          <h2>Table perks</h2>
          <p>
            <Sparkles size={17} /> You’ve earned {points} points on this visit.
          </p>
          <button
            className="primary"
            onClick={() => {
              setGame(
                ['🍋', '🍓', '🍒', '🍇', '🍋', '🍓', '🍒', '🍇']
                  .map((symbol) => ({ symbol, key: Math.random() }))
                  .sort((a, b) => a.key - b.key)
                  .map((card) => card.symbol),
              )
              setFlipped([])
              setMatched([])
              setPanel('game')
            }}
          >
            Play memory match
          </button>
        </>
      )}
      {panel === 'game' && (
        <>
          <h2>Memory match</h2>
          <p>
            {matched.length === game.length ? 'You found every pair!' : 'Turn over two cards to find a pair.'}
          </p>
          <div className="game">
            {game.map((symbol, index) => (
              <button
                key={index}
                aria-label={'Card ' + (index + 1)}
                disabled={matched.includes(index) || flipped.includes(index) || flipped.length === 2}
                onClick={() => setFlipped([...flipped, index])}
              >
                {matched.includes(index) || flipped.includes(index) ? symbol : '?'}
              </button>
            ))}
          </div>
        </>
      )}
      {panel === 'qr' && qr && (
        <>
          <h2>Table QR code</h2>
          <img className="qr" src={qr.image} alt="Scan to open the guest menu" />
          <a href={qr.image} download="table-qr.png">
            Download QR
          </a>
          <p>
            <a href={qr.url}>Open guest menu</a>
          </p>
        </>
      )}
      {panel === 'bill' && (
        <>
          <h2>Your bill</h2>
          {guest?.orders
            .filter((order) => order.status !== 'Cancelled')
            .flatMap((order) =>
              order.items.map((item) => (
                <div className="bill-line" key={order.id + (item.lineId || item.id)}>
                  <span>
                    {item.quantity} × {item.name}
                    <OrderLineOptions item={item} />
                  </span>
                  <strong>{money(item.price * item.quantity)}</strong>
                </div>
              )),
            )}
          <div className="bill-line">
            <strong>Remaining balance</strong>
            <strong>{money(balance(guest))}</strong>
          </div>
          {balance(guest) > 0 && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                config.demo
                  ? setPanel('pay')
                  : perform({ action: 'call', reason: 'bill' }, 'A staff member will help you settle up.')
              }
            >
              {config.demo ? 'Split or pay' : 'Ask staff to settle up'}
            </button>
          )}
          {!!guest?.payments.length && (
            <>
              <p>
                <CircleCheck size={17} /> Paid{' '}
                {money(guest.payments.reduce((sum, payment) => sum + payment.amount + payment.tip, 0))}{' '}
                including tips
              </p>
              {balance(guest) === 0 && !guest.reviewed && (
                <button className="secondary" onClick={() => setPanel('review')}>
                  <Star size={16} /> Leave a review
                </button>
              )}
            </>
          )}
        </>
      )}
      {panel === 'pay' && (
        <form onSubmit={checkout}>
          <h2>{staffMode ? 'Record payment' : 'Split or pay'}</h2>
          <p>
            {money(balance(bill))} remaining{!staffMode && ' · Demo payment'}
          </p>
          <div className="split-options">
            {[2, 3, 4].map((people) => (
              <button
                type="button"
                key={people}
                onClick={(event) => {
                  event.currentTarget.form.elements.amount.value = (
                    Math.ceil(balance(bill) / people) / 100
                  ).toFixed(2)
                }}
              >
                1/{people}
              </button>
            ))}
          </div>
          <label>
            Amount to pay
            <input
              name="amount"
              type="number"
              min="0.01"
              max={balance(bill) / 100}
              step="0.01"
              defaultValue={(balance(bill) / 100).toFixed(2)}
              required
            />
          </label>
          <label>
            Tip
            <input name="tip" type="number" min="0" step="0.01" defaultValue="0" required />
          </label>
          {staffMode && (
            <label>
              Payment method
              <select name="method">
                <option value="card">Card terminal</option>
                <option value="cash">Cash</option>
                <option value="voucher">Voucher</option>
              </select>
            </label>
          )}
          <label>
            Receipt email (optional)
            <input name="email" type="email" maxLength={180} />
          </label>
          <button className="primary" disabled={busy}>
            {staffMode ? 'Record payment' : 'Confirm demo payment'}
          </button>
        </form>
      )}
      {panel === 'review' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const fields = new FormData(event.currentTarget)
            perform(
              { action: 'review', rating: Number(fields.get('rating')), comment: fields.get('comment') },
              'Thanks for your review.',
              table,
              () => setPanel(null),
            )
          }}
        >
          <h2>How was your visit?</h2>
          <label>
            Rating
            <select name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} / 5
                </option>
              ))}
            </select>
          </label>
          <label>
            Comment
            <textarea name="comment" maxLength={500} />
          </label>
          <button className="primary" disabled={busy}>
            Submit review
          </button>
        </form>
      )}
      {toast && (
        <div className="dialog-feedback">
          <span role="status">{toast}</span>
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}>
            <X size={17} />
          </button>
        </div>
      )}
    </Dialog>
  )
}
