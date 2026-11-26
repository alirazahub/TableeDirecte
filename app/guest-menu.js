'use client'

import { useState } from 'react'
import {
  ArrowDown,
  BellRing,
  ChevronRight,
  Gamepad2,
  Info,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Truck,
  Wifi,
  X,
} from 'lucide-react'
import { categories, menu } from '../lib/menu'
import { lineTotal, tableBalance } from '../lib/operations'
import { money } from './restaurant-api'

function DishCard({ item, soldOut, count, onAdd, onDetails }) {
  const tag = soldOut ? 'Sold out' : item.label || item.diet
  return (
    <article className={soldOut ? 'dish sold-out' : 'dish'}>
      <button className="dish-photo" aria-label={'View ' + item.name} onClick={onDetails}>
        <img src={item.image} alt="" loading="lazy" />
        {tag && <span className="dish-tag">{tag}</span>}
      </button>
      <div className="dish-info">
        <button className="dish-title" onClick={onDetails}>
          {item.name}
        </button>
        <p>{item.description}</p>
        <footer>
          <strong>{money(item.price)}</strong>
          <button
            className="add"
            aria-label={'Add ' + item.name}
            onClick={onAdd}
            disabled={soldOut || count >= 20}
          >
            {count > 0 && <span>{count}</span>}
            <Plus size={18} />
          </button>
        </footer>
      </div>
    </article>
  )
}

function OrderSummary({
  table,
  lines,
  count,
  note,
  setNote,
  unavailableInCart,
  quantity,
  guest,
  busy,
  onOrder,
  onDelivery,
}) {
  return (
    <aside className="cart" id="order-cart" aria-labelledby="cart-title">
      <header className="cart-head">
        <span className="cart-icon">
          <ShoppingBag size={20} />
        </span>
        <div>
          <h2 id="cart-title">Your order</h2>
          <p>Table {table}</p>
        </div>
        <span className="cart-count" aria-label={count + ' items'}>
          {count}
        </span>
      </header>
      {lines.length > 0 ? (
        <ul className="cart-lines">
          {lines.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{money(item.quantity * item.price)}</span>
              <div className="stepper">
                <button aria-label={'Remove one ' + item.name} onClick={() => quantity(item.id, -1)}>
                  <Minus size={14} />
                </button>
                <span>{item.quantity}</span>
                <button
                  aria-label={'Add one ' + item.name}
                  disabled={item.quantity >= 20}
                  onClick={() => quantity(item.id, 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <ShoppingBag size={24} />
          <strong>Your bag is empty</strong>
          <p>Add a dish to get started.</p>
        </div>
      )}
      {lines.length > 0 && (
        <label className="order-note">
          Kitchen note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={250}
            placeholder="E.g. sauce on the side"
          />
        </label>
      )}
      {unavailableInCart && <p className="cart-warning">Remove sold-out items to place your order.</p>}
      <div className="cart-bottom">
        <div>
          <span>Subtotal</span>
          <strong>{money(lineTotal(lines))}</strong>
        </div>
        <button
          className="primary"
          disabled={!count || busy || !guest || unavailableInCart}
          onClick={onOrder}
        >
          Place table order
        </button>
        <button className="secondary" disabled={!count || busy || unavailableInCart} onClick={onDelivery}>
          <Truck size={16} /> Order for delivery
        </button>
      </div>
      {!!guest?.orders.length && (
        <div className="order-status">
          <h3>At your table</h3>
          {guest.orders.map((order) => (
            <div key={order.id}>
              <span>{order.items.map((item) => item.quantity + ' × ' + item.name).join(', ')}</span>
              <b className="status-chip" data-stage={order.status}>
                {order.status === 'Placed' ? 'Received' : order.status}
              </b>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

export default function GuestMenu({
  table,
  guest,
  cart,
  lines,
  note,
  setNote,
  unavailable,
  quantity,
  openPanel,
  openDish,
  busy,
  tracking,
  onOrder,
}) {
  const [category, setCategory] = useState(categories[0])
  const [search, setSearch] = useState('')
  const [diet, setDiet] = useState('')
  const count = lines.reduce((sum, item) => sum + item.quantity, 0)
  const query = search.trim().toLowerCase()
  const dishes = menu.filter(
    (item) =>
      (category === categories[0] || item.category === category) &&
      (!diet || item.diet === diet || (diet === 'Vegetarian' && item.diet === 'Vegan')) &&
      (item.name + ' ' + item.description).toLowerCase().includes(query),
  )
  const due = tableBalance(guest)
  const pending = guest?.calls.filter((call) => !call.resolved).length || 0
  const shortcuts = [
    ['Call waiter', pending ? pending + ' pending' : 'Request assistance', BellRing, 'service'],
    ['View bill', due ? money(due) + ' due' : 'Split or settle up', ReceiptText, 'bill'],
    ['Guest Wi-Fi', 'Network details', Wifi, 'wifi'],
    ['Table perks', 'Rewards & games', Gamepad2, 'extras'],
  ]
  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-label">
            TABLE {table} <span aria-hidden="true">/</span> DINE IN
          </span>
          <h1>
            Good food.
            <br />
            <em>Better company.</em>
          </h1>
          <p>Explore the menu, send your order, and settle the bill from your table.</p>
          <div className="hero-actions">
            <button className="hero-action" onClick={() => scrollToSection('guest-menu')}>
              Browse menu <ArrowDown size={16} />
            </button>
            <button className="hero-link" onClick={() => openPanel(tracking ? 'tracking' : 'guide')}>
              {tracking ? <Truck size={17} /> : <Info size={17} />}{' '}
              {tracking ? 'Track delivery' : 'How it works'}
            </button>
          </div>
        </div>
        <div className="hero-photo" aria-hidden="true" />
      </section>

      <section className="shortcuts" aria-label="Table services">
        {shortcuts.map(([label, detail, Icon, panel]) => (
          <button key={panel} onClick={() => openPanel(panel)} disabled={panel === 'service' && busy}>
            <span className="shortcut-icon">
              <Icon size={20} />
            </span>
            <span>
              {label}
              <small>{detail}</small>
            </span>
            <ChevronRight className="shortcut-arrow" size={17} />
          </button>
        ))}
      </section>

      <div className="guest-grid">
        <section id="guest-menu" className="menu" aria-labelledby="menu-title">
          <div className="section-header">
            <div>
              <h2 id="menu-title">Explore the menu</h2>
              <p>Made to order, served at your table.</p>
            </div>
            <span className="menu-count">
              {dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'}
            </span>
          </div>
          <div className="menu-tools">
            <label className="menu-search">
              <Search size={19} />
              <input
                aria-label="Search menu"
                placeholder="Search the menu"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Dietary preference"
              value={diet}
              onChange={(event) => setDiet(event.target.value)}
            >
              <option value="">All diets</option>
              <option>Vegetarian</option>
              <option>Vegan</option>
            </select>
          </div>
          <div className="filters" aria-label="Menu categories">
            {categories.map((name) => (
              <button
                key={name}
                className={name === category ? 'chosen' : ''}
                aria-pressed={name === category}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {dishes.length > 0 ? (
            <div className="dishes">
              {dishes.map((item) => (
                <DishCard
                  key={item.id}
                  item={item}
                  soldOut={unavailable.includes(item.id)}
                  count={cart[item.id] || 0}
                  onAdd={() => quantity(item.id, 1)}
                  onDetails={() => openDish(item)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state menu-empty">
              <Search size={22} />
              <strong>No dishes match these filters</strong>
              <button
                onClick={() => {
                  setSearch('')
                  setDiet('')
                  setCategory(categories[0])
                }}
              >
                <X size={15} /> Clear filters
              </button>
            </div>
          )}
        </section>
        <OrderSummary
          {...{ table, lines, count, note, setNote, busy, quantity, guest, onOrder }}
          unavailableInCart={lines.some((item) => unavailable.includes(item.id))}
          onDelivery={() => openPanel('delivery')}
        />
      </div>
      {count > 0 && (
        <div className="mobile-cart">
          <button className="primary" onClick={() => scrollToSection('order-cart')}>
            <span>
              <ShoppingBag size={18} /> View order <small>{count}</small>
            </span>
            <strong>{money(lineTotal(lines))}</strong>
          </button>
        </div>
      )}
    </>
  )
}
