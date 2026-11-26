'use client'
import {useEffect, useState} from 'react'
import { BellRing, ChefHat, CircleCheck, Clock3, Gamepad2, LayoutGrid, Minus, Plus, QrCode, ReceiptText, ShoppingBag, Sparkles, Star, Utensils, Wifi, X } from 'lucide-react'
import {categories, menu} from '../lib/menu'

const money = cents => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(cents / 100)
const total = items => items.reduce((sum, item) => sum + item.price * item.quantity, 0)
const balance = data => (data?.orders || []).reduce((sum, order) => sum + total(order.items), 0) - (data?.payments || []).reduce((sum, payment) => sum + payment.amount, 0)
const next = {Placed:'Cooking', Cooking:'Ready', Ready:'Served'}
const actionLabel = {Placed:'Send to kitchen', Cooking:'Mark ready', Ready:'Mark served'}
const seconds = (start, now) => Math.max(0, Math.floor((now - start) / 1000))
const timer = (start, now) => {const elapsed = seconds(start, now); return Math.floor(elapsed / 60) + 'm ' + elapsed % 60 + 's'}
async function api(path, key, pin, body) {
  const response = await fetch('/service/' + path, {cache:'no-store', method:body ? 'POST' : 'GET', headers:{'Content-Type':'application/json','X-Table-Key':key,'X-Staff-Pin':pin}, body:body && JSON.stringify(body)})
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The restaurant service is unavailable.')
  return result
}

export default function Restaurant({table, tableKey}) {
  const [category, setCategory] = useState('All dishes')
  const [cart, setCart] = useState({})
  const [panel, setPanel] = useState(null)
  const [dish, setDish] = useState(null)
  const [guest, setGuest] = useState(null)
  const [tables, setTables] = useState([])
  const [pin, setPin] = useState('')
  const [view, setView] = useState('menu')
  const [config, setConfig] = useState({})
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(0)
  const [qr, setQr] = useState(null)
  const [game, setGame] = useState([])
  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const [connection, setConnection] = useState('')
  const [payTable, setPayTable] = useState(null)
  const lines = menu.filter(item => cart[item.id]).map(item => ({...item, quantity:cart[item.id]}))
  const count = lines.reduce((sum, item) => sum + item.quantity, 0)
  const activeTables = tables.filter(item => item.orders.length || item.calls.some(call => !call.resolved))
  const points = Math.floor((guest?.payments || []).reduce((sum, payment) => sum + payment.amount, 0) / 100)
  const bill = (payTable && tables.find(item => item._id === payTable._id)) || guest
  const staffMode = view !== 'menu'

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const data = await api(staffMode ? 'tables' : 'tables/' + table, tableKey, staffMode ? pin : '')
        if (active) {staffMode ? setTables(data) : setGuest(data); setConnection('')}
      } catch (error) {if (active) setConnection(error.message)}
      if (active) setNow(Date.now())
    }
    refresh()
    const interval = setInterval(refresh, 2500)
    return () => {active = false; clearInterval(interval)}
  }, [staffMode, pin, table, tableKey])

  useEffect(() => {
    if (!panel) return
    const closeOnEscape = event => {if (event.key === 'Escape') setPanel(null)}
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [panel])
  useEffect(() => {api('config', '', '').then(setConfig).catch(() => {})}, [])
  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (flipped.length !== 2) return
    const [first, second] = flipped
    const timeout = setTimeout(() => {
      if (game[first] === game[second]) setMatched(previous => [...previous, first, second])
      setFlipped([])
    }, 650)
    return () => clearTimeout(timeout)
  }, [flipped, game])

  function quantity(id, change) {setCart(previous => ({...previous, [id]:Math.min(20, Math.max(0, (previous[id] || 0) + change))}))}
  async function perform(body, message, id = table, after) {
    if (busy) return
    setBusy(true)
    try {
      const result = await api('tables/' + id, tableKey, staffMode ? pin : '', body)
      if (staffMode) setTables(previous => previous.map(item => item._id === id ? {...result.table, reviews:item.reviews} : item))
      if (id === table && !staffMode) setGuest(result.table)
      setToast(result.notice || message)
      after?.()
    } catch (error) {setToast(error.message)}
    finally {setBusy(false)}
  }
  async function signIn(event) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('pin')
    try {
      setTables(await api('tables', '', value))
      setPin(value); setView('floor'); setPanel(null)
    } catch (error) {setToast(error.message)}
  }
  function checkout(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    perform({action:'pay', amount:Math.round(Number(fields.get('amount')) * 100), tip:Math.round(Number(fields.get('tip')) * 100), email:fields.get('email')}, 'Payment recorded.', bill._id, () => {setPanel(staffMode ? null : 'bill'); setPayTable(null)})
  }
  async function showQr(id) {
    try {setQr(await api('tables/' + id + '/qr', '', pin)); setPanel('qr')}
    catch (error) {setToast(error.message)}
  }

  return <>
    <header className="top"><div className="top-inner">
      <button className="brand" onClick={() => setView('menu')}><span className="brand-icon"><Utensils size={21}/></span><span>Tablée Directe<small>DE LA TABLE À LA CUISINE</small></span></button>
      <nav aria-label="Primary"><button className={view === 'menu' ? 'selected' : ''} onClick={() => setView('menu')}>Guest menu</button><button className={staffMode ? 'selected' : ''} onClick={() => pin ? setView('floor') : setPanel('staff')}>Staff dashboard</button></nav>
      <span className="table-tag"><span/> Table {String(table).padStart(2, '0')}</span>
    </div></header>
    <main className="shell">
    {connection && <p className="connection" role="status">{connection}</p>}
    {!staffMode ? <>
      <section className="hero"><div className="hero-content"><span className="hero-label"><span/> THE TABLÉE DIRECTE EXPERIENCE</span><h1>Good food.<br/><em>Better company.</em></h1><p>Settle in, explore the menu, and order whenever you’re ready.</p></div></section>
      <div className="shortcuts">
        <button onClick={() => perform({action:'call'}, 'A staff member is on the way.')} disabled={busy}><BellRing/><span>Call waiter<small>Need a hand?</small></span></button>
        <button onClick={() => {setPayTable(null); setPanel('bill')}}><ReceiptText/><span>View bill<small>{balance(guest) ? money(balance(guest)) + ' due' : 'Split or settle up'}</small></span></button>
        <button onClick={() => setPanel('wifi')}><Wifi/><span>Guest Wi-Fi<small>Get connected</small></span></button>
        <button onClick={() => setPanel('extras')}><Gamepad2/><span>Table perks<small>Rewards & games</small></span></button>
      </div>
      <div className="guest-grid"><section className="menu">
        <div className="section-header"><div><h2>Explore the menu</h2><p>Made to order, served right to your table.</p></div><button className="cart-jump" onClick={() => document.getElementById("order-cart").scrollIntoView({behavior:"smooth"})}><ShoppingBag size={17}/> Order ({count})</button><span className="menu-icon"><LayoutGrid size={20}/></span></div>
        <div className="filters">{categories.map(name => <button key={name} className={name === category ? 'chosen' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
        <div className="dishes">{menu.filter(item => category === 'All dishes' || category === item.category).map(item => <article className="dish" key={item.id}>
          <button aria-label={'View ' + item.name} className="dish-photo" style={{backgroundImage:'url("' + item.image + '")'}} onClick={() => {setDish(item); setPanel('dish')}}>{item.label && <span>{item.label}</span>}</button>
          <div className="dish-info"><button className="dish-title" onClick={() => {setDish(item); setPanel('dish')}}>{item.name}</button><p>{item.description}</p>
          <footer><strong>{money(item.price)}</strong><button className="add" aria-label={'Add ' + item.name} onClick={() => quantity(item.id, 1)}><Plus size={20}/></button></footer></div>
        </article>)}</div>
      </section>
      <aside className="cart" id="order-cart"><div className="cart-head"><ShoppingBag size={20}/><h2>Your order</h2><span>{count}</span></div>
        {lines.length ? <ul className="cart-lines">{lines.map(item => <li key={item.id}><strong>{item.name}</strong><span>{money(item.quantity * item.price)}</span><div className="stepper"><button aria-label={'Remove one ' + item.name} onClick={() => quantity(item.id, -1)}><Minus size={15}/></button>{item.quantity}<button aria-label={'Add one ' + item.name} onClick={() => quantity(item.id, 1)}><Plus size={15}/></button></div></li>)}</ul> : <div className="empty"><span><ShoppingBag size={27}/></span><strong>Your bag is empty</strong><p>Add something delicious from the menu.</p></div>}
        <div className="cart-bottom"><div><span>Subtotal</span><strong>{money(total(lines))}</strong></div><button className="primary" disabled={!count || busy || !guest} onClick={() => perform({action:'order',items:lines.map(({id, quantity}) => ({id, quantity}))}, 'Order sent to staff.', table, () => setCart({}))}>Place order</button></div>
        {!!guest?.orders.length && <div className="order-status"><h3>At your table</h3>{guest.orders.map(order => <div key={order.id}><span>{order.items.map(item => item.quantity + ' × ' + item.name).join(', ')}</span><b>{order.status}</b></div>)}</div>}
      </aside></div>
    </> : <>
      <section className="staff-header"><h1>{view === 'floor' ? 'Floor dashboard' : 'Kitchen display'}</h1><p>{view === 'floor' ? activeTables.length + ' active tables' : 'Live orders and cooking timers'}</p><div className="filters"><button className={view === 'floor' ? 'chosen' : ''} onClick={() => setView('floor')}>Floor</button><button className={view === 'kitchen' ? 'chosen' : ''} onClick={() => setView('kitchen')}>Kitchen</button><button onClick={() => {setView('menu'); setPin(''); setTables([])}}>Sign out</button></div></section>
      {view === 'floor' ? <div className="floor">{tables.map(item => <article className="staff-card" key={item._id}>
        <div className="staff-card-head"><h2>Table {String(item._id).padStart(2, '0')}</h2><button className="icon-button" aria-label={'Show QR for table ' + item._id} onClick={() => showQr(item._id)}><QrCode size={19}/></button></div>
        {item.calls.filter(call => !call.resolved).map(call => <div className="staff-row" key={call.id}><b>Waiter requested</b><button disabled={busy} onClick={() => perform({action:'resolve',callId:call.id}, 'Request resolved.', item._id)}>Resolve</button></div>)}
        {item.orders.map(order => <div className="staff-order" key={order.id}><div className="staff-row"><strong>{order.status}</strong><small>{timer(order.createdAt, now)}</small></div><p>{order.items.map(line => line.quantity + ' × ' + line.name).join(', ')}</p>{['Placed','Ready'].includes(order.status) && <button disabled={busy} onClick={() => perform({action:'status',orderId:order.id,status:next[order.status]}, 'Order updated.', item._id)}>{actionLabel[order.status]}</button>}</div>)}
        {item.reviews?.map(review => <p key={review.id}>★ {review.rating}/5 {review.comment}</p>)}
        {balance(item) > 0 ? <button className="primary" onClick={() => {setPayTable(item);setPanel('pay')}}>Record payment · {money(balance(item))}</button> : item.orders.length || item.calls.length ? <button disabled={busy} onClick={() => perform({action:'close'}, 'Table closed.', item._id)}>Close table</button> : <p className="muted">Available</p>}
      </article>)}</div> : <div className="floor">{tables.flatMap(item => item.orders.filter(order => order.status === 'Cooking' || order.status === 'Ready').map(order => <article className="staff-card" key={order.id}><div className="staff-card-head"><h2>Table {item._id}</h2><b><Clock3 size={15}/> {timer(order.updatedAt, now)}</b></div><p>{order.status}</p>{order.items.map(line => <p key={line.id}>{line.quantity} × {line.name}</p>)}{order.status === 'Cooking' && <button className="primary" disabled={busy} onClick={() => perform({action:'status',orderId:order.id,status:'Ready'}, 'Order ready.', item._id)}>Mark ready</button>}</article>))}{!tables.some(item => item.orders.some(order => ['Cooking','Ready'].includes(order.status))) && <p className="muted">No orders in the kitchen.</p>}</div>}
    </>}
    </main>
    <footer className="site-footer"><ChefHat size={17}/> Tablée Directe</footer>
    {toast && <div className="toast" role="status">{toast}</div>}
    {panel && <div className="overlay" onClick={() => setPanel(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="Tablée Directe options" onClick={event => event.stopPropagation()}>
      <button className="icon-button close" aria-label="Close dialog" onClick={() => setPanel(null)}><X size={21}/></button>
      {panel === 'dish' && dish && <><img className="modal-food" src={dish.image} alt={dish.name}/><h2>{dish.name}</h2><p>{dish.description}</p><button className="primary" onClick={() => {quantity(dish.id, 1);setPanel(null)}}>Add to order · {money(dish.price)}</button></>}
      {panel === 'staff' && <form onSubmit={signIn}><h2>Staff sign-in</h2>{config.demo && <p>Demo PIN is 2468.</p>}<label>Staff PIN<input autoFocus name="pin" type="password" required/></label><button className="primary">Open dashboard</button></form>}
      {panel === 'wifi' && <><h2>Guest Wi-Fi</h2><p>Network <strong>{config.wifi || 'Unavailable'}</strong></p>{config.wifiPassword && <p>Password <strong>{config.wifiPassword}</strong></p>}</>}
      {panel === 'extras' && <><h2>Table perks</h2><p><Sparkles size={17}/> You’ve earned {points} points on this visit.</p><button className="primary" onClick={() => {setGame(['🍋','🍓','🍒','🍇','🍋','🍓','🍒','🍇'].map(symbol => ({symbol, key:Math.random()})).sort((a,b) => a.key-b.key).map(card => card.symbol));setFlipped([]);setMatched([]);setPanel('game')}}>Play memory match</button></>}
      {panel === 'game' && <><h2>Memory match</h2><p>{matched.length === game.length ? 'You found every pair!' : 'Turn over two cards to find a pair.'}</p><div className="game">{game.map((symbol, index) => <button key={index} aria-label={'Card ' + (index + 1)} disabled={matched.includes(index) || flipped.includes(index) || flipped.length === 2} onClick={() => setFlipped([...flipped, index])}>{matched.includes(index) || flipped.includes(index) ? symbol : '?'}</button>)}</div></>}
      {panel === 'qr' && qr && <><h2>Table QR code</h2><img className="qr" src={qr.image} alt="Scan to open the guest menu"/><a href={qr.image} download="table-qr.png">Download QR</a><p><a href={qr.url}>Open guest menu</a></p></>}
      {panel === 'bill' && <><h2>Your bill</h2>{guest?.orders.flatMap(order => order.items.map(item => <div className="bill-line" key={order.id + item.id}><span>{item.quantity} × {item.name}</span><strong>{money(item.price * item.quantity)}</strong></div>))}<div className="bill-line"><strong>Remaining balance</strong><strong>{money(balance(guest))}</strong></div>
      {balance(guest) > 0 && <button className="primary" disabled={busy} onClick={() => config.demo ? setPanel('pay') : perform({action:'call'}, 'A staff member will help you settle up.')}>{config.demo ? 'Split or pay' : 'Ask staff to settle up'}</button>}
      {!!guest?.payments.length && <><p><CircleCheck size={17}/> Paid {money(guest.payments.reduce((sum, payment) => sum + payment.amount + payment.tip, 0))} including tips</p>{balance(guest) === 0 && <button onClick={() => setPanel('review')}><Star size={16}/> Leave a review</button>}</>}</>}
      {panel === 'pay' && <form onSubmit={checkout}><h2>{staffMode ? 'Record payment' : 'Split or pay'}</h2><p>{money(balance(bill))} remaining{!staffMode && ' · Demo payment'}</p><label>Amount to pay<input name="amount" type="number" min="0.01" max={balance(bill) / 100} step="0.01" defaultValue={(balance(bill) / 100).toFixed(2)} required/></label><label>Tip<input name="tip" type="number" min="0" step="0.01" defaultValue="0" required/></label><label>Receipt email (optional)<input name="email" type="email" maxLength={180}/></label><button className="primary" disabled={busy}>{staffMode ? 'Record payment' : 'Confirm demo payment'}</button></form>}
      {panel === 'review' && <form onSubmit={event => {event.preventDefault();const fields = new FormData(event.currentTarget);perform({action:'review',rating:Number(fields.get('rating')),comment:fields.get('comment')}, 'Thanks for your review.', table, () => setPanel(null))}}><h2>How was your visit?</h2><label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(rating => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label><label>Comment<textarea name="comment" maxLength={500}/></label><button className="primary" disabled={busy}>Submit review</button></form>}
    </section></div>}
  </>
}
