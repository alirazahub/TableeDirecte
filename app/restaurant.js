'use client'
import {useEffect, useState} from 'react'
import { Search, BellRing, ChefHat, CircleCheck, Gamepad2, LayoutGrid, Minus, Plus, ReceiptText, ShoppingBag, Sparkles, Star, Utensils, Wifi, X } from 'lucide-react'
import {categories, menu} from '../lib/menu'

import {lineTotal as total, paidTotal, serviceReasons, tableBalance as balance} from '../lib/operations'
import StaffWorkspace from './staff-workspace'

const euro = new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'})
const money = cents => euro.format(cents / 100)
async function api(path, key, pin, body) {
  const response = await fetch('/service/' + path, {cache:'no-store', method:body ? 'POST' : 'GET', headers:{'Content-Type':'application/json','X-Table-Key':key,'X-Staff-Pin':pin}, body:body && JSON.stringify(body)})
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The restaurant service is unavailable.')
  return result
}

export default function Restaurant({table, tableKey}) {
  const [category, setCategory] = useState('All dishes')
  const [search, setSearch] = useState('')
  const [diet, setDiet] = useState('')
  const [note, setNote] = useState('')
  const [unavailable, setUnavailable] = useState([])
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
  const searchText = search.trim().toLowerCase()
  const dishes = menu.filter(item => (category === 'All dishes' || item.category === category) &&
    (!diet || item.diet === diet || (diet === 'Vegetarian' && item.diet === 'Vegan')) &&
    (item.name + ' ' + item.description).toLowerCase().includes(searchText))
  const unavailableInCart = lines.some(item => unavailable.includes(item.id))
  const points = Math.floor(paidTotal(guest?.payments || []) / 100)
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
    const refreshMenu = async () => {
      try {
        const data = await api('menu', '', '')
        if (active) setUnavailable(data.unavailable)
      } catch {}
    }
    refresh()
    refreshMenu()
    let ticks = 0
    const interval = setInterval(() => {
      refresh()
      if (++ticks % 3 === 0) refreshMenu()
    }, 2500)
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
      if (staffMode) setTables(previous => previous.map(item => item._id === id ? {...item, ...result.table} : item))
      if (id === table && !staffMode) setGuest(result.table)
      setToast(result.notice || message)
      after?.()
    } catch (error) {setToast(error.message)}
    finally {setBusy(false)}
  }
  async function toggleDish(id, available) {
    if (busy) return
    setBusy(true)
    try {
      const data = await api('menu', '', pin, {id,available})
      setUnavailable(data.unavailable)
      setToast(available ? 'Dish available again.' : 'Dish marked sold out.')
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
    perform({action:'pay', amount:Math.round(Number(fields.get('amount')) * 100), tip:Math.round(Number(fields.get('tip')) * 100), email:fields.get('email'), method:fields.get('method')}, 'Payment recorded.', bill._id, () => {setPanel(staffMode ? null : 'bill'); setPayTable(null)})
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
      <section className="hero"><div className="hero-content"><span className="hero-label"><span/> THE TABLÉE DIRECTE EXPERIENCE</span><h1>Good food.<br/><em>Better company.</em></h1><p>Settle in, explore the menu, and order whenever you’re ready.</p><button className="hero-action" onClick={() => setPanel('guide')}>How it works</button></div></section>
      <div className="shortcuts">
        <button onClick={() => setPanel('service')} disabled={busy}><BellRing/><span>Call waiter<small>Need a hand?</small></span></button>
        <button onClick={() => {setPayTable(null); setPanel('bill')}}><ReceiptText/><span>View bill<small>{balance(guest) ? money(balance(guest)) + ' due' : 'Split or settle up'}</small></span></button>
        <button onClick={() => setPanel('wifi')}><Wifi/><span>Guest Wi-Fi<small>Get connected</small></span></button>
        <button onClick={() => setPanel('extras')}><Gamepad2/><span>Table perks<small>Rewards & games</small></span></button>
      </div>
      <div className="guest-grid"><section className="menu">
        <div className="section-header"><div><h2>Explore the menu</h2><p>Made to order, served right to your table.</p></div><button className="cart-jump" onClick={() => document.getElementById("order-cart").scrollIntoView({behavior:"smooth"})}><ShoppingBag size={17}/> Order ({count})</button><span className="menu-icon"><LayoutGrid size={20}/></span></div>
        <div className="menu-tools"><label className="menu-search"><Search size={19}/><input aria-label="Search menu" placeholder="Search dishes or ingredients" type="search" value={search} onChange={event => setSearch(event.target.value)}/></label>
          <select aria-label="Dietary preference" value={diet} onChange={event => setDiet(event.target.value)}><option value="">All diets</option><option>Vegetarian</option><option>Vegan</option></select></div>
        <div className="filters">{categories.map(name => <button key={name} className={name === category ? 'chosen' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
        <div className="dishes">{dishes.map(item => <article className="dish" key={item.id}>
          <button aria-label={'View ' + item.name} className="dish-photo" style={{backgroundImage:'url("' + item.image + '")'}} onClick={() => {setDish(item); setPanel('dish')}}>{(unavailable.includes(item.id) || item.label || item.diet) && <span>{unavailable.includes(item.id) ? 'Sold out' : item.label || item.diet}</span>}</button>
          <div className="dish-info"><button className="dish-title" onClick={() => {setDish(item); setPanel('dish')}}>{item.name}</button><p>{item.description}</p>
          <footer><strong>{money(item.price)}</strong><button className="add" aria-label={'Add ' + item.name} disabled={unavailable.includes(item.id)} onClick={() => quantity(item.id, 1)}><Plus size={20}/></button></footer></div>
        </article>)}{!dishes.length && <p className="empty-state">No dishes match these filters.</p>}</div>
      </section>
      <aside className="cart" id="order-cart"><div className="cart-head"><ShoppingBag size={20}/><h2>Your order</h2><span>{count}</span></div>
        {lines.length ? <ul className="cart-lines">{lines.map(item => <li key={item.id}><strong>{item.name}</strong><span>{money(item.quantity * item.price)}</span><div className="stepper"><button aria-label={'Remove one ' + item.name} onClick={() => quantity(item.id, -1)}><Minus size={15}/></button>{item.quantity}<button aria-label={'Add one ' + item.name} onClick={() => quantity(item.id, 1)}><Plus size={15}/></button></div></li>)}</ul> : <div className="empty"><span><ShoppingBag size={27}/></span><strong>Your bag is empty</strong><p>Add something delicious from the menu.</p></div>}
        {lines.length > 0 && <label className="order-note">Kitchen note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={250} placeholder="E.g. sauce on the side"/></label>}
        {unavailableInCart && <p className="cart-warning">Remove sold-out items to place your order.</p>}
        <div className="cart-bottom"><div><span>Subtotal</span><strong>{money(total(lines))}</strong></div><button className="primary" disabled={!count || busy || !guest || unavailableInCart} onClick={() => perform({action:'order',note,items:lines.map(({id, quantity}) => ({id, quantity}))}, 'Order sent to staff.', table, () => {setCart({});setNote('')})}>Place order</button></div>
        {!!guest?.orders.length && <div className="order-status"><h3>At your table</h3>{guest.orders.map(order => <div key={order.id}><span>{order.items.map(item => item.quantity + ' × ' + item.name).join(', ')}</span><b>{order.status}</b></div>)}</div>}
      </aside></div>
    </> : <>
      <StaffWorkspace {...{view,setView,tables,now,busy,perform,money,showQr,unavailable,toggleDish}}
        demo={config.demo} openPayment={item => {setPayTable(item);setPanel('pay')}}
        signOut={() => {setView('menu');setPin('');setTables([])}}/>
    </>}
    </main>
    <footer className="site-footer"><ChefHat size={17}/> Tablée Directe</footer>
    {toast && <div className="toast" role="status">{toast}</div>}
    {panel && <div className="overlay" onClick={() => setPanel(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="Tablée Directe options" onClick={event => event.stopPropagation()}>
      <button className="icon-button close" aria-label="Close dialog" onClick={() => setPanel(null)}><X size={21}/></button>
      {panel === 'dish' && dish && <><img className="modal-food" src={dish.image} alt={dish.name}/><h2>{dish.name}</h2><p>{dish.description}</p>{dish.diet && <p className="diet-label">{dish.diet}</p>}<p><strong>Sample allergen information</strong> · {dish.allergens}</p><p className="muted">Please ask the team about cross-contact before ordering.</p><button className="primary" disabled={unavailable.includes(dish.id)} onClick={() => {quantity(dish.id, 1);setPanel(null)}}>{unavailable.includes(dish.id) ? 'Sold out' : 'Add to order · ' + money(dish.price)}</button></>}
      {panel === 'staff' && <form onSubmit={signIn}><h2>Staff sign-in</h2>{config.demo && <p>Demo PIN is 2468.</p>}<label>Staff PIN<input autoFocus name="pin" type="password" required/></label><button className="primary">Open dashboard</button></form>}
      {panel === 'guide' && <><h2>From table to kitchen</h2><div className="feature-guide">
        <div><strong>Scan and browse</strong><p>Your table’s QR code opens the menu. Search dishes and check dietary details.</p></div>
        <div><strong>Send an order</strong><p>Add dishes, leave kitchen notes, and follow each order as it’s prepared.</p></div>
        <div><strong>Get help at the table</strong><p>Request water, cutlery, or assistance. Find Wi-Fi, points, and games in the guest menu.</p></div>
        <div><strong>Split the bill</strong><p>Choose a share, add a tip, and leave a review after the bill is settled.</p></div>
      </div></>}
      {panel === 'service'  && <><h2>How can we help?</h2><p>Send a request to your floor team.</p><div className="service-options">{Object.entries(serviceReasons).map(([reason,label]) => {
        const pending = guest?.calls.some(call => !call.resolved && (call.reason || 'help') === reason)
        return <button key={reason} disabled={busy || pending} onClick={() => perform({action:'call',reason}, 'Request sent to staff.', table, () => setPanel(null))}>{label}{pending && ' · Requested'}</button>
      })}</div></>}
      {panel === 'wifi'  && <><h2>Guest Wi-Fi</h2><p>Network <strong>{config.wifi || 'Unavailable'}</strong></p>{config.wifiPassword && <p>Password <strong>{config.wifiPassword}</strong></p>}</>}
      {panel === 'extras' && <><h2>Table perks</h2><p><Sparkles size={17}/> You’ve earned {points} points on this visit.</p><button className="primary" onClick={() => {setGame(['🍋','🍓','🍒','🍇','🍋','🍓','🍒','🍇'].map(symbol => ({symbol, key:Math.random()})).sort((a,b) => a.key-b.key).map(card => card.symbol));setFlipped([]);setMatched([]);setPanel('game')}}>Play memory match</button></>}
      {panel === 'game' && <><h2>Memory match</h2><p>{matched.length === game.length ? 'You found every pair!' : 'Turn over two cards to find a pair.'}</p><div className="game">{game.map((symbol, index) => <button key={index} aria-label={'Card ' + (index + 1)} disabled={matched.includes(index) || flipped.includes(index) || flipped.length === 2} onClick={() => setFlipped([...flipped, index])}>{matched.includes(index) || flipped.includes(index) ? symbol : '?'}</button>)}</div></>}
      {panel === 'qr' && qr && <><h2>Table QR code</h2><img className="qr" src={qr.image} alt="Scan to open the guest menu"/><a href={qr.image} download="table-qr.png">Download QR</a><p><a href={qr.url}>Open guest menu</a></p></>}
      {panel === 'bill' && <><h2>Your bill</h2>{guest?.orders.filter(order => order.status !== 'Cancelled').flatMap(order => order.items.map(item => <div className="bill-line" key={order.id + item.id}><span>{item.quantity} × {item.name}</span><strong>{money(item.price * item.quantity)}</strong></div>))}<div className="bill-line"><strong>Remaining balance</strong><strong>{money(balance(guest))}</strong></div>
      {balance(guest) > 0 && <button className="primary" disabled={busy} onClick={() => config.demo ? setPanel('pay') : perform({action:'call',reason:'bill'}, 'A staff member will help you settle up.')}>{config.demo ? 'Split or pay' : 'Ask staff to settle up'}</button>}
      {!!guest?.payments.length && <><p><CircleCheck size={17}/> Paid {money(guest.payments.reduce((sum, payment) => sum + payment.amount + payment.tip, 0))} including tips</p>{balance(guest) === 0 && !guest.reviewed && <button onClick={() => setPanel('review')}><Star size={16}/> Leave a review</button>}</>}</>}
      {panel === 'pay' && <form onSubmit={checkout}><h2>{staffMode ? 'Record payment' : 'Split or pay'}</h2><p>{money(balance(bill))} remaining{!staffMode && ' · Demo payment'}</p><div className="split-options">{[2,3,4].map(people => <button type="button" key={people} onClick={event => {
        event.currentTarget.form.elements.amount.value = (Math.ceil(balance(bill) / people) / 100).toFixed(2)
      }}>1/{people}</button>)}</div><label>Amount to pay<input name="amount" type="number" min="0.01" max={balance(bill) / 100} step="0.01" defaultValue={(balance(bill) / 100).toFixed(2)} required/></label><label>Tip<input name="tip" type="number" min="0" step="0.01" defaultValue="0" required/></label>{staffMode && <label>Payment method<select name="method"><option value="card">Card terminal</option><option value="cash">Cash</option><option value="voucher">Voucher</option></select></label>}<label>Receipt email (optional)<input name="email" type="email" maxLength={180}/></label><button className="primary" disabled={busy}>{staffMode ? 'Record payment' : 'Confirm demo payment'}</button></form>}
      {panel === 'review' && <form onSubmit={event => {event.preventDefault();const fields = new FormData(event.currentTarget);perform({action:'review',rating:Number(fields.get('rating')),comment:fields.get('comment')}, 'Thanks for your review.', table, () => setPanel(null))}}><h2>How was your visit?</h2><label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(rating => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label><label>Comment<textarea name="comment" maxLength={500}/></label><button className="primary" disabled={busy}>Submit review</button></form>}
    </section></div>}
  </>
}
