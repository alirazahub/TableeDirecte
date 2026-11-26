'use client'

import {useEffect,useRef,useState} from 'react'
export function useLiveRefresh(scope,refresh) {
  const latest = useRef(refresh)
  useEffect(() => {latest.current = refresh},[refresh])
  const [live,setLive] = useState(false)
  const scopeJson = JSON.stringify(scope)
  useEffect(() => {
    let active = true
    let socket
    let retry
    let wait = 750
    let connected = false
    let refreshTimer
    const run = () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {if (active) latest.current()},80)
    }
    const connect = () => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(protocol + '//' + location.host + '/api/live')
      socket.onopen = () => socket.send(scopeJson)
      socket.onmessage = ({data}) => {
        if (data === 'ready') {
          connected = true
          wait = 750
          setLive(true)
        }
        if (data === 'ready' || data === 'change') run()
      }
      socket.onclose = () => {
        if (!active) return
        connected = false
        setLive(false)
        retry = setTimeout(connect,wait)
        wait = Math.min(wait * 2,15000)
      }
      socket.onerror = () => socket.close()
    }
    run()
    if (scopeJson !== 'null') connect()
    const fallback = setInterval(() => {if (!connected) run()},3500)
    return () => {
      active = false
      clearTimeout(retry)
      clearTimeout(refreshTimer)
      clearInterval(fallback)
      socket?.close()
      setLive(false)
    }
  },[scopeJson])
  return live
}
