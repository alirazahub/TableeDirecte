'use client'

import { useRef, useState } from 'react'
import { maxShapePoints, validOutline } from '../lib/floor-layout'

const clip = (val) => Math.min(100, Math.max(0, Math.round(val)))

export default function TableShapeEditor({ outline, onChange }) {
  const drag = useRef(null)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  function append(next) {
    if (outline.length < maxShapePoints && !outline.some((item) => item.x === next.x && item.y === next.y)) {
      onChange([...outline, next])
    }
  }
  function point(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clip(((event.clientX - bounds.left) * 100) / bounds.width),
      y: clip(((event.clientY - bounds.top) * 100) / bounds.height),
    }
  }
  function start(event) {
    if (event.button !== 0) return
    const index = event.target.getAttribute('data-point')
    if (index !== null) {
      drag.current = { index: Number(index), pointer: event.pointerId }
      event.currentTarget.setPointerCapture(event.pointerId)
    } else append(point(event))
  }
  function move(event) {
    if (!drag.current || event.pointerId !== drag.current.pointer) return
    const index = drag.current.index
    const next = point(event)
    onChange(outline.map((item, i) => (i === index ? next : item)))
  }
  const coordinates = outline.map(({ x, y }) => x + ',' + y).join(' ')
  return (
    <div className="table-shape-editor">
      <p>Tap to add corners in order. Drag a corner to move it. The outline closes automatically.</p>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Custom table outline preview"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onLostPointerCapture={() => {
          drag.current = null
        }}
      >
        {outline.length >= 3 ? <polygon points={coordinates} /> : <polyline points={coordinates} />}
        {outline.map(({ x, y }, index) => (
          <circle key={index} cx={x} cy={y} r="3.4" data-point={index} />
        ))}
      </svg>
      <details>
        <summary>Enter corner coordinates</summary>
        <div className="floor-editor-fields">
          <label>
            Corner X
            <input
              type="number"
              min="0"
              max="100"
              value={x}
              onChange={(event) => setX(clip(Number(event.target.value)))}
            />
          </label>
          <label>
            Corner Y
            <input
              type="number"
              min="0"
              max="100"
              value={y}
              onChange={(event) => setY(clip(Number(event.target.value)))}
            />
          </label>
        </div>
        <button type="button" disabled={outline.length >= maxShapePoints} onClick={() => append({ x, y })}>
          Add corner
        </button>
      </details>
      <div className="shape-actions">
        <button type="button" disabled={!outline.length} onClick={() => onChange(outline.slice(0, -1))}>
          Undo corner
        </button>
        <button type="button" disabled={!outline.length} onClick={() => onChange([])}>
          Clear outline
        </button>
      </div>
      {outline.length > 0 && !validOutline(outline) && (
        <p role="status">Use at least three corners with no crossed edges.</p>
      )}
    </div>
  )
}
