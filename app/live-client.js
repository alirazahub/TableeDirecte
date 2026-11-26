'use client'

import {useEffect,useRef,useState} from 'react'

export function useLiveData(scope,onMessage) {
  const latest = useRef(onMessage)
  useEffect(() => {latest.current = onMessage},[onMessage])
  const [live,setLive] = useState(false)
  const scopeJson = JSON.stringify(scope)
  useEffect(() => {
    let active = true
    let socket
    let retry
    let wait = 750
    const connect = () => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(protocol + '//' + location.host + '/api/live')
      socket.onopen = () => socket.send(scopeJson)
      socket.onmessage = ({data}) => {
        if (!active) return
        let message
        try {message = JSON.parse(data)} catch {return}
        if (message.type === 'snapshot') {
          wait = 750
          setLive(true)
        }
        latest.current(message)
      }
      socket.onclose = ({code}) => {
        if (!active) return
        setLive(false)
        if (code === 1008) return
        retry = setTimeout(connect,wait)
        wait = Math.min(wait * 2,15000)
      }
      socket.onerror = () => socket.close()
    }
    connect()
    return () => {
      active = false
      clearTimeout(retry)
      socket?.close()
      setLive(false)
    }
  },[scopeJson])
  return live
}
