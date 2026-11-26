'use client'

import { useId, useState } from 'react'
import { Minus, Plus, Utensils } from 'lucide-react'
import { quoteDish } from '../lib/catalog'
import { money } from './restaurant-api'

function selectionHint(group) {
  if (group.min === 0) return 'Optional · up to ' + group.max
  if (group.min === group.max) return 'Required · choose ' + group.min
  return 'Required · choose ' + group.min + ' to ' + group.max
}

export default function DishCustomizer({ dish, soldOut, onAdd, initial }) {
  const groups = dish.groups || []
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(
      groups.map((group) => [
        group.id,
        group.choices
          .filter(
            (choice) =>
              initial?.selections &&
              Object.hasOwn(initial.selections, group.id) &&
              initial.selections[group.id].includes(choice.id),
          )
          .map((choice) => choice.id)
          .slice(0, group.max),
      ]),
    ),
  )
  const [quantity, setQuantity] = useState(initial?.quantity || 1)
  const [note, setNote] = useState(initial?.note || '')
  const groupPrefix = useId()
  const displayPrice =
    dish.price +
    groups.reduce(
      (sum, group) =>
        sum +
        group.choices
          .filter((choice) => selections[group.id]?.includes(choice.id))
          .reduce((extra, choice) => extra + choice.price, 0),
      0,
    )
  let valid = true
  try {
    quoteDish(dish, selections)
  } catch {
    valid = false
  }

  function choose(group, id) {
    setSelections((current) => {
      const picked = current[group.id] || []
      const next = picked.includes(id)
        ? picked.filter((item) => item !== id)
        : group.max === 1
          ? [id]
          : [...picked, id].slice(0, group.max)
      return { ...current, [group.id]: next }
    })
  }

  return (
    <form
      className="dish-customizer"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !soldOut) onAdd(dish, selections, note, quantity)
      }}
    >
      {dish.image ? (
        <img className="modal-food" src={dish.image} alt="" />
      ) : (
        <div className="menu-image-placeholder modal-food">
          <Utensils size={29} />
        </div>
      )}
      <h2>{dish.name}</h2>
      <p>{dish.description}</p>
      <strong className="customizer-price">{money(displayPrice)}</strong>
      {dish.allergens && (
        <details className="allergen-detail">
          <summary>Allergen information</summary>
          <p>{dish.allergens}</p>
          <p>Ask the team about cross-contact and selected add-ons.</p>
        </details>
      )}
      {groups.map((group) => {
        const selected = selections[group.id] || []
        return (
          <fieldset className="choice-group" key={group.id}>
            <legend>{group.name}</legend>
            <p>{selectionHint(group)}</p>
            {group.choices.map((choice) => (
              <label key={choice.id} className="choice-row">
                <input
                  type={group.max === 1 && group.min === 1 ? 'radio' : 'checkbox'}
                  name={groupPrefix + group.id}
                  checked={selected.includes(choice.id)}
                  disabled={!selected.includes(choice.id) && group.max > 1 && selected.length >= group.max}
                  onChange={() => choose(group, choice.id)}
                />
                <span>{choice.name}</span>
                {choice.price > 0 && <small>+{money(choice.price)}</small>}
              </label>
            ))}
          </fieldset>
        )
      })}
      <label>
        Special instructions (optional)
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={120}
          placeholder="E.g. no onions"
        />
      </label>
      <div className="customizer-footer">
        <div className="stepper">
          <button
            type="button"
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            onClick={() => setQuantity(quantity - 1)}
          >
            <Minus size={15} />
          </button>
          <strong>{quantity}</strong>
          <button
            type="button"
            disabled={quantity >= 20}
            aria-label="Increase quantity"
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus size={15} />
          </button>
        </div>
        <button disabled={soldOut || !valid} className="primary">
          {soldOut
            ? 'Sold out'
            : (initial ? 'Update order' : 'Add to order') + ' · ' + money(displayPrice * quantity)}
        </button>
      </div>
    </form>
  )
}
