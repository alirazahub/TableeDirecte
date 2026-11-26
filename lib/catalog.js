const idPattern = /^[a-z0-9-]{1,64}$/
const validId = (id) => typeof id === 'string' && idPattern.test(id)
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const cents = (value, max) => Number.isInteger(value) && value >= 0 && value <= max
const distinctIds = (list) => new Set(list.map((item) => item.id)).size === list.length

export function readDish(input) {
  if (!input || typeof input !== 'object') throw new Error('Fill in the dish details.')
  const { id, price } = input
  const name = text(input.name, 90)
  const category = text(input.category, 45)
  const image = text(input.image, 500)
  if (!validId(id) || !name || !category || !cents(price, 100000))
    throw new Error('A name, category, and valid price are required.')
  if (image) {
    try {
      if (new URL(image).protocol !== 'https:') throw new Error()
    } catch {
      throw new Error('Use an HTTPS image URL.')
    }
  }
  if (!Array.isArray(input.groups) || input.groups.length > 8)
    throw new Error('Use no more than eight choice groups.')
  const groups = input.groups.map((group) => {
    const { id, min, max, choices } = group || {}
    const name = text(group?.name, 65)
    if (
      !validId(id) ||
      !name ||
      !Array.isArray(choices) ||
      choices.length < 1 ||
      choices.length > 12 ||
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 0 ||
      max < Math.max(1, min) ||
      max > choices.length
    ) {
      throw new Error('Each choice group needs a name, choices, and a valid minimum and maximum.')
    }
    const options = choices.map((option) => {
      const { id, price } = option || {}
      const name = text(option?.name, 65)
      if (!validId(id) || !name || !cents(price, 50000))
        throw new Error('Every choice needs a name and a valid extra price.')
      return { id, name, price }
    })
    if (!distinctIds(options)) throw new Error('Choices within a group must be unique.')
    return { id, name, min, max, choices: options }
  })
  if (!distinctIds(groups)) throw new Error('Choice groups must be unique.')
  return {
    id,
    name,
    category,
    price,
    image,
    groups,
    description: text(input.description, 350),
    allergens: text(input.allergens, 200),
    diet: ['Vegetarian', 'Vegan'].includes(input.diet) ? input.diet : '',
    label: text(input.label, 35),
  }
}

export function quoteDish(dish, selections = {}) {
  if (!selections || typeof selections !== 'object' || Array.isArray(selections))
    throw new Error('Choose valid options.')
  const groups = dish.groups || []
  if (Object.keys(selections).some((id) => !groups.some((group) => group.id === id))) {
    throw new Error(dish.name + ' options have changed. Customize it again.')
  }
  const options = []
  for (const group of groups) {
    const picked = Object.hasOwn(selections, group.id) ? selections[group.id] : []
    if (
      !Array.isArray(picked) ||
      picked.some((id) => typeof id !== 'string') ||
      picked.length !== new Set(picked).size ||
      picked.length < group.min ||
      picked.length > group.max
    ) {
      throw new Error(
        group.name +
          ' requires ' +
          (group.min === group.max ? group.min : group.min + ' to ' + group.max) +
          ' choices.',
      )
    }
    const selected = group.choices.filter((choice) => picked.includes(choice.id))
    if (selected.length !== picked.length)
      throw new Error(dish.name + ' options have changed. Customize it again.')
    for (const choice of selected) options.push({ group: group.name, name: choice.name, price: choice.price })
  }
  return { price: dish.price + options.reduce((sum, item) => sum + item.price, 0), options }
}

export function lineKey(id, selections, note) {
  const sorted = Object.keys(selections)
    .sort()
    .flatMap((group) => {
      const options = selections[group]
      return options.length ? [[group, [...options].sort()]] : []
    })
  return JSON.stringify([id, sorted, note])
}
