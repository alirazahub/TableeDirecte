'use client'
import { useEffect, useReducer, useRef, useState } from 'react'
import { ChefHat, CircleUserRound, LayoutGrid, UtensilsCrossed, X } from 'lucide-react'
import { lineKey, quoteDish } from '../lib/catalog'
import { tableBalance as balance } from '../lib/operations'
import { roles } from '../lib/roles'
import GuestMenu from './guest-menu'
import RestaurantDialog from './restaurant-dialog'
import StaffWorkspace from './staff-workspace'
import { NotificationBell, NotificationPopups, NotificationTray, useNotificationSound } from './notifications'
import { useLiveData } from './live-client'
import { money, restaurantApi } from './restaurant-api'
import { initialRestaurantState, restaurantReducer } from './restaurant-state'

export default function Restaurant({ table, tableKey }) {
  const [state, dispatch] = useReducer(restaurantReducer, initialRestaurantState)
  const {
    guest,
    tables,
    unavailable,
    dishes,
    menuVersion,
    deliveries: deliveryOrders,
    drivers,
    tracking: tracked,
    connection,
    notifications,
  } = state
  const [note, setNote] = useState('')
  const [cart, setCart] = useState({})
  const [panel, setPanel] = useState(null)
  const [selectedDish, setSelectedDish] = useState(null)
  const [editingLine, setEditingLine] = useState(null)
  const [account, setAccount] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [customerOrders, setCustomerOrders] = useState([])
  const [seatingTable, setSeatingTable] = useState(null)
  const [tracking, setTracking] = useState('')
  const [view, setView] = useState('menu')
  const [config, setConfig] = useState({})
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState(null)
  const [payTable, setPayTable] = useState(null)
  const dish = selectedDish ? dishes.find((item) => item.id === selectedDish) : null
  const lines = Object.values(cart).map((line) => {
    const current = dishes.find((item) => item.id === line.id && !item.archived)
    try {
      if (!current || unavailable.includes(line.id)) throw new Error()
      return { ...line, name: current.name, ...quoteDish(current, line.selections), invalid: false }
    } catch {
      return { ...line, invalid: true, editable: Boolean(current) }
    }
  })
  const tableLabel = String(table).padStart(2, '0')
  const unavailableInCart = lines.some((item) => item.invalid)
  const orderItems = () =>
    lines.map(({ id, quantity, selections, note, price }) => ({
      id,
      quantity,
      selections,
      note,
      expectedUnitPrice: price,
    }))
  const actionPending = useRef(false)
  const bill = (payTable && tables.find((item) => item._id === payTable._id)) || guest
  const staffMode = view !== 'menu' && Boolean(account)
  const notificationScope = staffMode ? 'staff:' + account.username : 'guest:' + table
  const currentNotifications = notifications.filter((item) => item.scope === notificationScope)
  const sound = useNotificationSound(currentNotifications[0])
  function applyLiveMessage(message) {
    dispatch({
      ...message,
      notify: true,
      scope: notificationScope,
      role: staffMode ? account.role : undefined,
      at: Date.now(),
    })
  }
  const live = useLiveData(staffMode ? { staff: true } : { table, key: tableKey, tracking }, (message) => {
    if (message.type === 'error' && message.authentication) {
      setAccount(null)
      setView('menu')
      setToast(message.message)
      dispatch({ type: 'clear-staff' })
      return
    }
    applyLiveMessage(message)
  })
  function dismissNotification(id) {
    dispatch({ type: 'dismiss-notification', id })
  }

  useEffect(() => {
    let active = true
    restaurantApi('session')
      .then((result) => {
        if (active) setAccount(result.account)
      })
      .catch(() => {})
    restaurantApi('customer')
      .then((result) => {
        if (active) setCustomer(result.username)
      })
      .catch(() => {})
    restaurantApi('config')
      .then((result) => {
        if (active) setConfig(result)
      })
      .catch(() => {})
    const token = location.hash.startsWith('#delivery=') ? location.hash.slice(10) : ''
    if (token) {
      setTracking(token)
      setPanel('tracking')
    }
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timeout)
  }, [toast])

  async function runAction(action) {
    if (actionPending.current) return
    actionPending.current = true
    setBusy(true)
    try {
      await action()
    } catch (error) {
      setToast(error.message)
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  function quantity(key, change) {
    setCart((previous) => {
      const item = previous[key]
      if (!item) return previous
      const count = Math.min(20, item.quantity + change)
      if (count > 0) return { ...previous, [key]: { ...item, quantity: count } }
      const copy = { ...previous }
      delete copy[key]
      return copy
    })
  }

  function addConfigured(item, selections = {}, rawNote = '', amount = 1, replace = null) {
    const note = rawNote.trim()
    const quote = quoteDish(item, selections)
    const key = lineKey(item.id, selections, note)
    setCart((previous) => {
      const current = { ...previous }
      if (replace) delete current[replace.key]
      const quantity = Math.min(20, (current[key]?.quantity || 0) + amount)
      return {
        ...current,
        [key]: { id: item.id, key, name: item.name, selections, note, quantity, ...quote },
      }
    })
  }

  function openDish(item, line = null) {
    setSelectedDish(item.id)
    setEditingLine(line)
    openPanel('dish')
  }

  function perform(body, message, id = table, after) {
    return runAction(async () => {
      const result = await restaurantApi('tables/' + id, { tableKey: staffMode ? undefined : tableKey, body })
      if (staffMode) applyLiveMessage({ type: 'table', table: result.table })
      else if (id === table) applyLiveMessage({ type: 'guest', table: result.table })
      if (
        result.notice ||
        !['order', 'status', 'call', 'resolve', 'seat', 'close', 'pay'].includes(body.action)
      ) {
        setToast(result.notice || message)
      }
      after?.()
    })
  }

  function toggleDish(id, available) {
    return runAction(async () => {
      const data = await restaurantApi('menu', { body: { id, available } })
      applyLiveMessage({ type: 'menu', ...data })
    })
  }

  async function saveMenu(body) {
    const data = await restaurantApi('menu', { body })
    applyLiveMessage({ type: 'menu', ...data })
    setToast(body.action === 'save' ? 'Dish saved.' : body.archived ? 'Dish archived.' : 'Dish restored.')
  }

  function signIn(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    return runAction(async () => {
      const result = await restaurantApi('session', {
        body: { username: fields.get('username'), password: fields.get('password') },
      })
      setAccount(result.account)
      setView(roles[result.account.role].views[0])
      setPanel(null)
    })
  }

  function signOut() {
    return runAction(async () => {
      await restaurantApi('session', { body: { logout: true } })
      setAccount(null)
      setView('menu')
      dispatch({ type: 'clear-staff' })
    })
  }

  function showCustomer() {
    setPanel('customer')
    if (!customer) return
    return runAction(async () => setCustomerOrders(await restaurantApi('customer/orders')))
  }

  function customerAuth(event, mode) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    return runAction(async () => {
      const result = await restaurantApi('customer', {
        body: { mode, username: fields.get('username'), password: fields.get('password') },
      })
      setCustomer(result.username)
      setCustomerOrders(await restaurantApi('customer/orders'))
    })
  }

  function customerSignOut() {
    return runAction(async () => {
      await restaurantApi('customer', { body: { mode: 'logout' } })
      setCustomer(null)
      setCustomerOrders([])
      setPanel(null)
    })
  }

  function openTracking(key, order) {
    dispatch({ type: 'tracking', order })
    setTracking(key)
    setPanel('tracking')
    history.replaceState(null, '', '#delivery=' + key)
  }

  function performDelivery(id, body) {
    return runAction(async () => {
      const order = await restaurantApi('deliveries/' + id, { body })
      applyLiveMessage({ type: 'delivery', order })
      if (!Object.hasOwn(body, 'status') && !Object.hasOwn(body, 'driver')) setToast('Location shared.')
    })
  }

  function placeDelivery(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    return runAction(async () => {
      const data = await restaurantApi('deliveries', {
        body: {
          items: orderItems(),
          note,
          recipient: fields.get('recipient'),
          address: fields.get('address'),
          phone: fields.get('phone'),
        },
      })
      dispatch({
        type: 'delivery-placed',
        notify: true,
        scope: notificationScope,
        order: data.order,
        at: Date.now(),
      })
      openTracking(data.tracking, data.order)
      setCart({})
      setNote('')
    })
  }

  function checkout(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    perform(
      {
        action: 'pay',
        amount: Math.round(Number(fields.get('amount')) * 100),
        tip: Math.round(Number(fields.get('tip')) * 100),
        email: fields.get('email'),
        method: fields.get('method'),
      },
      'Payment recorded.',
      bill._id,
      () => {
        setPanel(staffMode ? null : 'bill')
        setPayTable(null)
      },
    )
  }
  function showQr(id) {
    return runAction(async () => {
      setQr(await restaurantApi('tables/' + id + '/qr'))
      setPanel('qr')
    })
  }

  function openPanel(name) {
    setToast('')
    if (name === 'bill') setPayTable(null)
    setPanel(name)
  }

  function placeTableOrder() {
    const items = orderItems()
    perform({ action: 'order', note, items }, 'Order sent to staff.', table, () => {
      setCart({})
      setNote('')
    })
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="top">
        <div className="top-inner">
          <button className="brand" onClick={() => setView('menu')}>
            <span className="brand-icon">
              <UtensilsCrossed size={21} />
            </span>
            <span>
              Tablée Directe<small>TABLE ORDERING</small>
            </span>
          </button>
          <nav aria-label="Primary">
            <button className={view === 'menu' ? 'selected' : ''} onClick={() => setView('menu')}>
              Guest menu
            </button>
            <button
              className={staffMode ? 'selected' : ''}
              onClick={() => (account ? setView(roles[account.role].views[0]) : openPanel('staff'))}
            >
              <LayoutGrid size={16} /> Staff dashboard
            </button>
          </nav>
          <div className="header-actions">
            <NotificationBell
              count={currentNotifications.length}
              onClick={() => openPanel('notifications')}
            />
            <button
              className="profile-nav"
              onClick={showCustomer}
              aria-label={customer ? 'My orders' : 'Customer account'}
            >
              <CircleUserRound size={21} />
              <span>{customer ? 'My orders' : 'Account'}</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main-content" className={staffMode ? 'shell staff-shell' : 'shell'}>
        {(connection || !live) && (
          <p className="connection" role="status">
            {connection || 'Connecting to live updates…'}
          </p>
        )}
        {staffMode ? (
          <StaffWorkspace
            {...{
              view,
              setView,
              tables,
              busy,
              perform,
              money,
              showQr,
              unavailable,
              toggleDish,
              dishes,
              menuVersion,
              saveMenu,
              account,
              live,
              deliveryOrders,
              drivers,
              performDelivery,
              signOut,
            }}
            demo={config.demo}
            notify={setToast}
            openPayment={(item) => {
              setPayTable(item)
              openPanel('pay')
            }}
            openSeating={(item) => {
              setSeatingTable(item)
              openPanel('seat')
            }}
          />
        ) : (
          <GuestMenu
            {...{
              guest,
              dishes,
              lines,
              note,
              setNote,
              unavailable,
              quantity,
              openPanel,
              busy,
              tracking,
              openDish,
            }}
            table={tableLabel}
            onOrder={placeTableOrder}
            onQuickAdd={(item) => (item.groups?.length ? openDish(item) : addConfigured(item))}
            onEditLine={(line) => {
              const item = dishes.find((dish) => dish.id === line.id && !dish.archived)
              if (item) openDish(item, line)
            }}
          />
        )}
      </main>
      <footer className="site-footer">
        <ChefHat size={17} /> Tablée Directe <span>De la table à la cuisine</span>
      </footer>
      {toast && !panel && (
        <div className="toast">
          <span role="status">{toast}</span>
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}>
            <X size={17} />
          </button>
        </div>
      )}
      <NotificationPopups items={currentNotifications} dismiss={dismissNotification} visible={!panel} />
      {panel === 'notifications' && (
        <NotificationTray
          items={currentNotifications}
          dismiss={dismissNotification}
          sound={sound}
          clear={() => dispatch({ type: 'dismiss-notifications', scope: notificationScope })}
          onClose={() => setPanel(null)}
        />
      )}
      {panel && panel !== 'notifications' && (
        <RestaurantDialog
          {...{
            panel,
            setPanel,
            dish,
            unavailable,
            editingLine,
            menuVersion,
            onCustomize: (item, selections, note, quantity) => {
              addConfigured(item, selections, note, quantity, editingLine)
              setPanel(null)
            },
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
          }}
        />
      )}
    </>
  )
}
