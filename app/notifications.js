'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  CircleCheck,
  ClipboardList,
  CreditCard,
  DoorOpen,
  Truck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import Dialog from './dialog'

const symbols = {
  order: ClipboardList,
  ready: CircleCheck,
  service: Bell,
  payment: CreditCard,
  delivery: Truck,
  table: DoorOpen,
}
const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function useNotificationSound(latest) {
  const [enabled, setEnabled] = useState(true)
  const context = useRef(null)
  const enabledRef = useRef(true)
  const lastSeen = useRef(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tablee-notification-sound') !== 'off'
      enabledRef.current = saved
      setEnabled(saved)
    } catch {}

    const unlock = () => {
      if (enabledRef.current) void getContext()
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      if (context.current) void context.current.close().catch(() => {})
      context.current = null
    }
  }, [])

  function getContext() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) return null
      context.current ??= new Audio()
      const audio = context.current
      if (audio.state === 'suspended') void audio.resume().catch(() => {})
      return audio
    } catch {
      return null
    }
  }
  function play(kind) {
    const audio = getContext()
    if (!audio || audio.state !== 'running') return
    const notes = kind === 'ready' ? [660, 880, 1047] : [523, 784]
    notes.forEach((frequency, index) => {
      const start = audio.currentTime + index * 0.09
      const osc = audio.createOscillator()
      const envelope = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      envelope.gain.setValueAtTime(0.001, start)
      envelope.gain.exponentialRampToValueAtTime(0.1, start + 0.025)
      envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
      osc.connect(envelope).connect(audio.destination)
      osc.start(start)
      osc.stop(start + 0.19)
      osc.onended = () => {
        osc.disconnect()
        envelope.disconnect()
      }
    })
  }
  function toggle() {
    const value = !enabledRef.current
    enabledRef.current = value
    setEnabled(value)
    try {
      localStorage.setItem('tablee-notification-sound', value ? 'on' : 'off')
    } catch {}
    if (value) {
      const audio = getContext()
      if (audio)
        void audio
          .resume()
          .then(() => {
            if (enabledRef.current) play('ready')
          })
          .catch(() => {})
    }
  }

  useEffect(() => {
    if (!latest || latest.id <= lastSeen.current) return
    lastSeen.current = latest.id
    if (enabledRef.current) play(latest.kind)
  }, [latest])

  return { enabled, toggle }
}

function NotificationItem({ item, dismiss }) {
  const Icon = symbols[item.kind] || Bell
  return (
    <div className="notification-item" data-kind={item.kind}>
      <span className="notification-icon" aria-hidden="true">
        <Icon size={19} />
      </span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
      </div>
      <button className="icon-button" aria-label={'Dismiss ' + item.title} onClick={() => dismiss(item.id)}>
        <X size={17} />
      </button>
    </div>
  )
}

export function NotificationBell({ count, onClick }) {
  return (
    <button
      className="icon-button notification-bell"
      aria-label={count ? 'Notifications (' + count + ')' : 'Notifications'}
      onClick={onClick}
    >
      <Bell size={20} />
      {count > 0 && <span aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </button>
  )
}

export function NotificationTray({ items, dismiss, clear, onClose, sound }) {
  const SoundIcon = sound.enabled ? Volume2 : VolumeX
  return (
    <Dialog label="Notifications" onClose={onClose}>
      <div className="notification-heading">
        <h2>Notifications</h2>
        <p>Updates for the current table or staff role.</p>
      </div>
      <div className="notification-toolbar">
        <button className="secondary" aria-pressed={sound.enabled} onClick={sound.toggle}>
          <SoundIcon size={17} /> {sound.enabled ? 'Sound on' : 'Enable sound'}
        </button>
        {items.length > 0 && <button onClick={clear}>Dismiss all</button>}
      </div>
      {items.length ? (
        <ul className="notification-list">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationItem {...{ item, dismiss }} />
              <time dateTime={new Date(item.at).toISOString()}>{time.format(item.at)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">You’re all caught up.</p>
      )}
    </Dialog>
  )
}

export function NotificationPopups({ items, dismiss, visible }) {
  const latest = items[0]
  const [cutoff, setCutoff] = useState(0)
  const preview = items.filter((item) => item.at > cutoff).slice(0, 3)
  const nextExpiry = preview.at(-1)?.at
  useEffect(() => {
    if (nextExpiry === undefined) return
    const expire = nextExpiry + 9000
    const timer = setTimeout(() => setCutoff(Date.now() - 9000), Math.max(1, expire - Date.now()))
    return () => clearTimeout(timer)
  }, [nextExpiry])
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {latest ? latest.title + '. ' + latest.detail : ''}
      </div>
      {visible && preview.length > 0 && (
        <section className="notification-popups" aria-label="Recent notifications">
          {preview.map((item) => (
            <NotificationItem key={item.id} {...{ item, dismiss }} />
          ))}
        </section>
      )}
    </>
  )
}
