'use client'

import { useRef, useState } from 'react'
import { LayoutGrid, Move, Pencil, Plus, RotateCcw, Save, UsersRound } from 'lucide-react'
import {
  firstOpenCell,
  maxFloorColumns,
  maxFloorRows,
  maxTables,
  overlappingTables,
  validOutline,
} from '../lib/floor-layout'
import Dialog from './dialog'
import TableShapeEditor from './table-shape-editor'

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
const adjust = (table, patch, columns, rows) => {
  const next = { ...table, ...patch }
  return {
    ...next,
    x: clamp(next.x, 0, columns - next.width),
    y: clamp(next.y, 0, rows - next.height),
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

function MapCanvas({ positions, columns, rows, tables, selected, onSelect, onMove, overlap, zoom = 100 }) {
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
      resize: Boolean(event.target.closest('[data-resize-handle]')),
      width: table.width,
      height: table.height,
      x: table.x,
      y: table.y,
      cellWidth: area.width / columns,
      cellHeight: area.height / rows,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(table.id)
  }

  function moveDrag(event) {
    const start = drag.current
    if (!start || event.pointerId !== start.pointer) return
    const dx = Math.round((event.clientX - start.clientX) / start.cellWidth)
    const dy = Math.round((event.clientY - start.clientY) / start.cellHeight)
    if (start.resize)
      onMove(start.id, {
        width: clamp(start.width + dx, 1, columns - start.x),
        height: clamp(start.height + dy, 1, rows - start.y),
      })
    else onMove(start.id, { x: start.x + dx, y: start.y + dy })
  }

  return (
    <div className="floor-map-scroll" tabIndex={0} aria-label="Scrollable floor map">
      <div
        className="floor-map-canvas"
        ref={canvas}
        data-editing={Boolean(onMove)}
        style={{
          width: 'max(' + zoom + '%, ' + Math.round((columns * 42 * zoom) / 100) + 'px)',
          aspectRatio: columns + '/' + rows * 0.66,
          backgroundSize: 100 / columns + '% ' + 100 / rows + '%',
        }}
      >
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
                left: (100 * table.x) / columns + '%',
                top: (100 * table.y) / rows + '%',
                width: (100 * table.width) / columns + '%',
                height: (100 * table.height) / rows + '%',
                '--table-outline':
                  table.shape === 'custom' && validOutline(table.outline)
                    ? 'polygon(' + table.outline.map(({ x, y }) => x + '% ' + y + '%').join(', ') + ')'
                    : undefined,
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
              {onMove && selected === table.id && (
                <span aria-hidden="true" className="floor-resize-handle" data-resize-handle />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FloorEditor({ layout, tables, onClose, onSave }) {
  const [positions, setPositions] = useState(layout.positions)
  const [columns, setColumns] = useState(layout.columns)
  const [rows, setRows] = useState(layout.rows)
  const [zoom, setZoom] = useState(100)
  const [selected, setSelected] = useState(layout.positions[0].id)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const overlap = overlappingTables(positions)
  const invalidShape = positions.some((item) => item.shape === 'custom' && !validOutline(item.outline))
  const minColumns = Math.max(4, ...positions.map((item) => item.x + item.width))
  const minRows = Math.max(4, ...positions.map((item) => item.y + item.height))
  const table = positions.find((item) => item.id === selected)

  function change(id, patch) {
    setPositions((current) =>
      current.map((item) => (item.id === id ? adjust(item, patch, columns, rows) : item)),
    )
    setError('')
  }

  function addTable() {
    if (positions.length >= maxTables) return
    const place = firstOpenCell(positions, columns, rows)
    if (!place) {
      setError('Increase the canvas size to make room for another table.')
      return
    }
    const id = String(positions.length + 1)
    setPositions([...positions, { id, ...place, seats: 2, shape: 'rectangle', label: '' }])
    setSelected(id)
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    if (saving || overlap.size || invalidShape) return
    setSaving(true)
    setError('')
    try {
      await onSave({ positions, columns, rows, version: layout.version })
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
          Resize the canvas, add a table, then drag it into place. Drag the corner handle to resize it, or use
          the fields.
        </p>
        <div className="floor-editor-toolbar">
          <label>
            Canvas columns
            <input
              type="number"
              min={minColumns}
              max={maxFloorColumns}
              value={columns}
              onChange={(event) => {
                if (Number.isInteger(event.target.valueAsNumber))
                  setColumns(clamp(event.target.valueAsNumber, minColumns, maxFloorColumns))
              }}
            />
          </label>
          <label>
            Canvas rows
            <input
              type="number"
              min={minRows}
              max={maxFloorRows}
              value={rows}
              onChange={(event) => {
                if (Number.isInteger(event.target.valueAsNumber))
                  setRows(clamp(event.target.valueAsNumber, minRows, maxFloorRows))
              }}
            />
          </label>
          <label>
            Zoom {zoom}%
            <input
              type="range"
              min="25"
              max="150"
              step="5"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={positions.length >= maxTables || saving}
            onClick={addTable}
          >
            <Plus size={17} /> Add table
          </button>
        </div>
        <div className="floor-editor-grid">
          <MapCanvas
            {...{ positions, columns, rows, tables, selected, overlap, zoom }}
            onMove={change}
            onSelect={setSelected}
          />
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
                  <option value="rounded">Rounded rectangle</option>
                  <option value="round">Round or oval</option>
                  <option value="custom">Draw custom shape</option>
                </select>
              </label>
              {numeric('Seats', 'seats', 1, 24)}
              {numeric('Column', 'x', 1, columns - table.width + 1, 1)}
              {numeric('Row', 'y', 1, rows - table.height + 1, 1)}
              {numeric('Width', 'width', 1, columns - table.x)}
              {numeric('Depth', 'height', 1, rows - table.y)}
            </div>
            {table.shape === 'custom' && (
              <TableShapeEditor
                key={table.id}
                outline={table.outline || []}
                onChange={(outline) => change(table.id, { outline })}
              />
            )}
          </section>
        </div>
        {overlap.size > 0 && (
          <p className="floor-overlap" role="status">
            Move the overlapping tables before saving.
          </p>
        )}
        {invalidShape && (
          <p className="floor-overlap" role="status">
            Complete all custom outlines before saving.
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
              setPositions(layout.positions)
              setColumns(layout.columns)
              setRows(layout.rows)
              setSelected(layout.positions[0].id)
              setZoom(100)
              setError('')
            }}
          >
            <RotateCcw size={16} /> Reset draft
          </button>
          <button className="primary" disabled={saving || overlap.size > 0 || invalidShape}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function FloorMap({ layout, tables, canEdit, onSave, onLocate, selected }) {
  const [editor, setEditor] = useState(null)
  const [zoom, setZoom] = useState(100)
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
          <div className="floor-map-tools">
            <label>
              Find a table
              <select
                value={selected || ''}
                onChange={(event) => {
                  if (event.target.value) onLocate(event.target.value)
                }}
              >
                <option value="">Select a table</option>
                {layout.positions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {tableName(item.id)}
                    {item.label ? ' · ' + item.label : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Map zoom
              <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
                <option value={125}>125%</option>
              </select>
            </label>
          </div>
          <MapCanvas
            positions={layout.positions}
            columns={layout.columns}
            rows={layout.rows}
            tables={tableIndex}
            onSelect={onLocate}
            selected={selected}
            zoom={zoom}
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
