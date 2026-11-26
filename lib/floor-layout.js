export const floorColumns = 12
export const floorRows = 8
export const tableIds = Array.from({ length: 12 }, (_, index) => String(index + 1))

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

export function overlappingTables(positions) {
  const overlap = new Set()
  for (let index = 0; index < positions.length; index++) {
    const left = positions[index]
    for (const right of positions.slice(index + 1)) {
      if (
        left.x < right.x + right.width &&
        right.x < left.x + left.width &&
        left.y < right.y + right.height &&
        right.y < left.y + left.height
      ) {
        overlap.add(left.id)
        overlap.add(right.id)
      }
    }
  }
  return overlap
}

export function readFloorLayout(positions) {
  if (!Array.isArray(positions) || positions.length !== tableIds.length) {
    throw new Error('Place all dining tables on the map.')
  }
  const indexed = new Map()
  for (const table of positions) {
    const { id, x, y, width, height, seats, shape, label } = table || {}
    if (!tableIds.includes(id) || indexed.has(id)) throw new Error('Every table must appear exactly once.')
    if (
      ![x, y, width, height, seats].every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      width < 1 ||
      height < 1 ||
      width > 4 ||
      height > 4 ||
      x + width > floorColumns ||
      y + height > floorRows
    ) {
      throw new Error('Keep every table inside the floor map. Table sizes can be one to four grid cells.')
    }
    if (
      seats < 1 ||
      seats > 24 ||
      !['rectangle', 'round'].includes(shape) ||
      typeof label !== 'string' ||
      label.length > 36
    ) {
      throw new Error('Use a supported shape, one to 24 seats, and a label of up to 36 characters.')
    }
    indexed.set(id, { id, x, y, width, height, seats, shape, label: label.trim() })
  }
  const layout = tableIds.map((id) => indexed.get(id))
  if (overlappingTables(layout).size) throw new Error('Move the overlapping tables before saving.')
  return layout
}
