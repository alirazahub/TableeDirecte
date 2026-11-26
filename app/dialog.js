'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Dialog({ label, onClose, children, className = '' }) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className={['modal', className].filter(Boolean).join(' ')}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose()
      }}
    >
      <button className="icon-button close" aria-label="Close dialog" onClick={onClose}>
        <X size={19} />
      </button>
      {children}
    </dialog>
  )
}
