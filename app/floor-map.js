'use client'

import { useRef, useState } from 'react'
import { LayoutGrid, Move, Pencil, RotateCcw, Save, UsersRound } from 'lucide-react'
import { defaultFloorLayout, floorColumns, floorRows, overlappingTables } from '../lib/floor-layout'
import Dialog from './dialog'

const navigation = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
const labels = {
  available: 'Available',
  seated: 'In service',
  request: 'Waiter request',
  placed: 'New order',
  cooking: 'Cooking',
  ready: 'Ready to serve',
}
const tableName = (id) => 'Table ' + id.padStart(2, '0')
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const adjust = (table, patch) => {
  const next = { ...table, ...patch }
  return {
    ...next,
    x: clamp(next.x, 0, floorColumns - next.width),
    y: clamp(next.y, 0, floorRows - next.height),
  }
}

function tableStatus(table) {
  if (!table) return null
  if (table.calls.some((call) => !call.resolved)) return 'request'
  if (table.orders.some((order) => order.status === 'Ready')) return 'ready'
  if (table.orders.some((order) => order.status === 'Cooking')) return 'cooking'
  if (table.orders.some((order) => order.status === 'Placed')) return 'placed'
  if (table.seating || table.orders.some((order) => order.status !== 'Cancelled')) return 'seated'
  return 'available'
}

function MapCanvas({ positions, tables, selected, onSelect, onMove, overlap }) {
  const canvas = useRef(null)
  const drag = useRef(null)

  function startDrag(event, table) {
    if (!onMove || event.button !== 0) return
    const area = canvas.current.getBoundingClientRect()
    drag.current = {
      pointer: event.pointerId,
      id: table.id,
      clientX: event.clientX,
      clientY: event.clientY,
      x: table.x,
      y: table.y,
      cellWidth: area.width / floorColumns,
      cellHeight: area.height / floorRows,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(table.id)
  }

  function moveDrag(event) {
    const start = drag.current
    if (!start || event.pointerId !== start.pointer) return
    const x = start.x + Math.round((event.clientX - start.clientX) / start.cellWidth)
    const y = start.y + Math.round((event.clientY - start.clientY) / start.cellHeight)
    onMove(start.id, { x, y })
  }

  return (
    <div className="floor-map-scroll" tabIndex={0} aria-label="Scrollable floor map">
      <div className="floor-map-canvas" ref={canvas} data-editing={Boolean(onMove)}>
        {positions.map((table) => {
          const status = tableStatus(tables.get(table.id))
          const name = tableName(table.id)
          return (
            <button
              type="button"
              key={table.id}
              className="floor-map-table"
              data-shape={table.shape}
              data-status={status || 'unknown'}
              data-selected={selected === table.id}
              data-overlap={overlap?.has(table.id)}
              aria-label={[name, table.label, table.seats + ' seats', labels[status]]
                .filter(Boolean)
                .join(', ')}
              aria-pressed={selected === table.id}
              style={{
                left: (100 * table.x) / floorColumns + '%',
                top: (100 * table.y) / floorRows + '%',
                width: (100 * table.width) / floorColumns + '%',
                height: (100 * table.height) / floorRows + '%',
              }}
              onClick={() => onSelect(table.id)}
              onPointerDown={(event) => startDrag(event, table)}
              onPointerMove={moveDrag}
              onPointerUp={() => {
                drag.current = null
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
              onPointerCancel={() => {
                drag.current = null
              }}
              onKeyDown={(event) => {
                const direction = Object.hasOwn(navigation, event.key) ? navigation[event.key] : null
                if (!onMove || !direction) return
                event.preventDefault()
                onSelect(table.id)
                onMove(table.id, { x: table.x + direction[0], y: table.y + direction[1] })
              }}
            >
              <strong>{name}</strong>
              {table.label && <span className="floor-table-label">{table.label}</span>}
              <span className="floor-table-meta">
                {onMove ? (
                  <>
                    <UsersRound size={12} /> {table.seats}
                  </>
                ) : (
                  labels[status] || 'Loading'
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FloorEditor({ layout, tables, onClose, onSave }) {
  const [positions, setPositions] = useState(layout.positions)
  const [selected, setSelected] = useState(layout.positions[0].id)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const overlap = overlappingTables(positions)
  const table = positions.find((item) => item.id === selected)

  function change(id, patch) {
    setPositions((current) => current.map((item) => (item.id === id ? adjust(item, patch) : item)))
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    if (saving || overlap.size) return
    setSaving(true)
    setError('')
    try {
      await onSave({ positions, version: layout.version })
      onClose()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  function numeric(label, field, min, max, offset = 0) {
    return (
      <label key={field}>
        {label}
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          value={table[field] + offset}
          required
          onChange={(event) => {
            if (Number.isInteger(event.target.valueAsNumber)) {
              change(table.id, { [field]: clamp(event.target.valueAsNumber, min, max) - offset })
            }
          }}
        />
      </label>
    )
  }

  return (
    <Dialog
      label="Design floor layout"
      className="floor-editor-modal"
      onClose={() => {
        if (!saving) onClose()
      }}
    >
      <form onSubmit={save}>
        <h2>Design floor layout</h2>
        <p>
          Drag a table into position, or select it and use the arrow keys. Table numbers and QR codes stay
          linked to the same table.
        </p>
        <div className="floor-editor-grid">
          <MapCanvas {...{ positions, tables, selected, overlap }} onMove={change} onSelect={setSelected} />
          <section className="floor-editor-controls" aria-label="Selected table details">
            <label>
              Selected table
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                {positions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {tableName(item.id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Label (optional)
              <input
                value={table.label}
                onChange={(event) => change(table.id, { label: event.target.value })}
                maxLength={36}
                placeholder="E.g. Window"
              />
            </label>
            <div className="floor-editor-fields">
              <label>
                Shape
                <select
                  value={table.shape}
                  onChange={(event) => change(table.id, { shape: event.target.value })}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="round">Round</option>
                </select>
              </label>
              {numeric('Seats', 'seats', 1, 24)}
              {numeric('Column', 'x', 1, floorColumns - table.width + 1, 1)}
              {numeric('Row', 'y', 1, floorRows - table.height + 1, 1)}
              {numeric('Width', 'width', 1, 4)}
              {numeric('Depth', 'height', 1, 4)}
            </div>
          </section>
        </div>
        {overlap.size > 0 && (
          <p className="floor-overlap" role="status">
            Move the overlapping tables before saving.
          </p>
        )}
        {error && (
          <p className="floor-overlap" role="alert">
            {error}
          </p>
        )}
        <div className="floor-editor-actions">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => {
              setPositions(defaultFloorLayout())
              setError('')
            }}
          >
            <RotateCcw size={16} /> Reset draft
          </button>
          <button className="primary" disabled={saving || overlap.size > 0}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function FloorMap({ layout, tables, canEdit, onSave, onLocate, selected }) {
  const [editor, setEditor] = useState(null)
  const tableIndex = new Map(tables.map((table) => [table._id, table]))
  return (
    <section className="floor-map-card" aria-label="Dining room map">
      <div className="floor-map-heading">
        <div>
          <h2>
            <LayoutGrid size={19} /> Dining room map
          </h2>
          <p>Select a table to find its details or kitchen tickets.</p>
        </div>
        {canEdit && (
          <button className="secondary" disabled={!layout} onClick={() => setEditor(layout)}>
            <Pencil size={17} /> Design layout
          </button>
        )}
      </div>
      {layout ? (
        <>
          <MapCanvas
            positions={layout.positions}
            tables={tableIndex}
            onSelect={onLocate}
            selected={selected}
          />
          <div className="floor-map-legend" aria-label="Table status legend">
            {Object.entries(labels).map(([key, label]) => (
              <span key={key} data-status={key}>
                <i aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">
          <Move size={17} /> Loading floor layout…
        </p>
      )}
      {editor && (
        <FloorEditor layout={editor} tables={tableIndex} onSave={onSave} onClose={() => setEditor(null)} />
      )}
    </section>
  )
}
