export const floorColumns = 12
export const floorRows = 8
export const maxFloorColumns = 64
export const maxFloorRows = 48
export const maxTables = 120
export const maxShapePoints = 24
export const shapes = ['rectangle', 'rounded', 'round', 'custom']
export const tableIds = Array.from({ length: 12 }, (_, index) => String(index + 1))
export const isTableId = (id) =>
  typeof id === 'string' && /^[1-9][0-9]{0,2}$/.test(id) && Number(id) <= maxTables

export function defaultFloorLayout() {
  return tableIds.map((id, index) => ({
    id,
    x: (index % 4) * 3 + 1,
    y: Math.floor(index / 4) * 2 + 1,
    width: 2,
    height: 2,
    seats: 4,
    shape: 'rectangle',
    label: '',
  }))
}

export function intersects(left, right) {
  return (
    left.x < right.x + right.width &&
    right.x < left.x + left.width &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height
  )
}

export function overlappingTables(positions) {
  const overlap = new Set()
  for (let index = 0; index < positions.length; index++) {
    for (const other of positions.slice(index + 1)) {
      if (intersects(positions[index], other)) {
        overlap.add(positions[index].id)
        overlap.add(other.id)
      }
    }
  }
  return overlap
}

export function firstOpenCell(positions, columns, rows) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const cell = { x, y, width: 1, height: 1 }
      if (!positions.some((table) => intersects(table, cell))) return cell
    }
  }
  return null
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}
function onSegment(a, b, c) {
  return (
    c.x >= Math.min(a.x, b.x) &&
    c.x <= Math.max(a.x, b.x) &&
    c.y >= Math.min(a.y, b.y) &&
    c.y <= Math.max(a.y, b.y)
  )
}
function segmentsCross(a, b, c, d) {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b)
  if (
    (abC === 0 && onSegment(a, b, c)) ||
    (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) ||
    (cdB === 0 && onSegment(c, d, b))
  )
    return true
  return abC * abD < 0 && cdA * cdB < 0
}

export function validOutline(points) {
  if (!Array.isArray(points) || points.length < 3 || points.length > maxShapePoints) return false
  if (
    points.some(
      (point) =>
        !point ||
        !Number.isInteger(point.x) ||
        !Number.isInteger(point.y) ||
        point.x < 0 ||
        point.x > 100 ||
        point.y < 0 ||
        point.y > 100,
    )
  )
    return false
  if (new Set(points.map(({ x, y }) => x + ',' + y)).size !== points.length) return false
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue
      if (segmentsCross(a, b, points[j], points[(j + 1) % points.length])) return false
    }
  }
  return Math.abs(area) >= 50
}

export function readFloorLayout(input, existingIds = tableIds) {
  const { positions, columns = floorColumns, rows = floorRows } = input || {}
  if (
    !Number.isInteger(columns) ||
    columns < 4 ||
    columns > maxFloorColumns ||
    !Number.isInteger(rows) ||
    rows < 4 ||
    rows > maxFloorRows
  )
    throw new Error('Use 4–64 columns and 4–48 rows.')
  if (!Array.isArray(positions) || positions.length < existingIds.length || positions.length > maxTables) {
    throw new Error('Keep your existing tables and place up to ' + maxTables + ' in total.')
  }

  const indexed = new Map()
  for (const table of positions) {
    const { id, x, y, width, height, seats, shape, label, outline } = table || {}
    if (!isTableId(id) || indexed.has(id)) throw new Error('Every table must have a unique number.')
    if (
      ![x, y, width, height, seats].every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      width < 1 ||
      height < 1 ||
      x + width > columns ||
      y + height > rows
    )
      throw new Error('Keep every table inside the floor map.')
    if (
      seats < 1 ||
      seats > 24 ||
      !shapes.includes(shape) ||
      typeof label !== 'string' ||
      label.length > 36
    ) {
      throw new Error('Use a supported shape, one to 24 seats, and a label of up to 36 characters.')
    }
    if (shape === 'custom' && !validOutline(outline))
      throw new Error('Draw each custom outline with 3–24 distinct points and no crossing edges.')
    indexed.set(id, {
      id,
      x,
      y,
      width,
      height,
      seats,
      shape,
      label: label.trim(),
      ...(shape === 'custom' ? { outline: outline.map(({ x, y }) => ({ x, y })) } : {}),
    })
  }

  const ids = Array.from({ length: positions.length }, (_, index) => String(index + 1))
  if (existingIds.some((id) => !indexed.has(id)) || ids.some((id) => !indexed.has(id))) {
    throw new Error('Keep existing table numbers and add new tables in sequence.')
  }
  const ordered = ids.map((id) => indexed.get(id))
  if (overlappingTables(ordered).size) throw new Error('Move the overlapping table areas before saving.')
  return { positions: ordered, columns, rows }
}
