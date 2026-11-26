'use client'

import { useState } from 'react'
import { Archive, Image, Pencil, Plus, RotateCcw, Search, Utensils, X } from 'lucide-react'
import Dialog from './dialog'
import { money } from './restaurant-api'

const euro = (cents) => (cents / 100).toFixed(2)
const amount = (value) => (value === '' ? NaN : Math.round(Number(value) * 100))
const newChoice = () => ({ id: crypto.randomUUID(), name: '', price: '0.00' })
const newGroup = () => ({ id: crypto.randomUUID(), name: '', min: 1, max: 1, choices: [newChoice()] })

function dishDraft(dish) {
  if (!dish)
    return {
      id: crypto.randomUUID(),
      name: '',
      category: '',
      price: '',
      image: '',
      description: '',
      allergens: '',
      diet: '',
      label: '',
      groups: [],
    }
  return {
    ...dish,
    price: euro(dish.price),
    groups: (dish.groups || []).map((group) => ({
      ...group,
      choices: group.choices.map((choice) => ({ ...choice, price: euro(choice.price) })),
    })),
  }
}

function ChoiceGroup({ group, index, update, remove }) {
  function updateChoice(id, patch) {
    update({ choices: group.choices.map((choice) => (choice.id === id ? { ...choice, ...patch } : choice)) })
  }

  function removeChoice(id) {
    const choices = group.choices.filter((choice) => choice.id !== id)
    update({ choices, min: Math.min(group.min, choices.length), max: Math.min(group.max, choices.length) })
  }

  return (
    <fieldset className="editor-group">
      <legend>Choice group {index + 1}</legend>
      <div className="editor-group-title">
        <label>
          Group name
          <input
            value={group.name}
            onChange={(event) => update({ name: event.target.value })}
            maxLength={65}
            required
            placeholder="E.g. Choose your drink"
          />
        </label>
        <button
          type="button"
          className="icon-button"
          onClick={remove}
          aria-label={'Remove group ' + (index + 1)}
        >
          <X size={17} />
        </button>
      </div>
      <div className="editor-grid">
        <label>
          Minimum choices
          <input
            type="number"
            min={0}
            max={group.choices.length}
            value={group.min}
            onChange={(event) => update({ min: Number(event.target.value) })}
            required
          />
        </label>
        <label>
          Maximum choices
          <input
            type="number"
            min={Math.max(1, group.min)}
            max={group.choices.length}
            value={group.max}
            onChange={(event) => update({ max: Number(event.target.value) })}
            required
          />
        </label>
      </div>
      {group.choices.map((choice, choiceIndex) => (
        <div className="editor-choice" key={choice.id}>
          <label>
            Choice {choiceIndex + 1}
            <input
              value={choice.name}
              maxLength={65}
              required
              onChange={(event) => updateChoice(choice.id, { name: event.target.value })}
            />
          </label>
          <label>
            Extra €
            <input
              type="number"
              min="0"
              max="500"
              step=".01"
              value={choice.price}
              required
              onChange={(event) => updateChoice(choice.id, { price: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={'Remove choice ' + (choiceIndex + 1)}
            disabled={group.choices.length === 1}
            onClick={() => removeChoice(choice.id)}
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary editor-add"
        disabled={group.choices.length >= 12}
        onClick={() => update({ choices: [...group.choices, newChoice()] })}
      >
        <Plus size={16} /> Add choice
      </button>
    </fieldset>
  )
}

function DishEditor({ editor, close, save }) {
  const [draft, setDraft] = useState(() => dishDraft(editor.dish))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }))
  const updateGroup = (id, patch) =>
    setDraft((previous) => ({
      ...previous,
      groups: previous.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)),
    }))

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await save({
        action: 'save',
        version: editor.version,
        dish: {
          ...draft,
          price: amount(draft.price),
          groups: draft.groups.map((group) => ({
            ...group,
            choices: group.choices.map((choice) => ({ ...choice, price: amount(choice.price) })),
          })),
        },
      })
      close()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      label={editor.dish ? 'Edit dish' : 'Add dish'}
      onClose={() => {
        if (!saving) close()
      }}
    >
      <form className="dish-editor" onSubmit={submit}>
        <h2>{editor.dish ? 'Edit dish' : 'Add dish'}</h2>
        <div className="editor-grid">
          <label>
            Dish name
            <input
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              maxLength={90}
              required
              autoFocus
            />
          </label>
          <label>
            Category
            <input
              value={draft.category}
              onChange={(event) => set('category', event.target.value)}
              maxLength={45}
              required
              placeholder="E.g. Meal combos"
            />
          </label>
          <label>
            Base price (€)
            <input
              type="number"
              min="0"
              max="1000"
              step=".01"
              value={draft.price}
              onChange={(event) => set('price', event.target.value)}
              required
            />
          </label>
          <label>
            Diet
            <select value={draft.diet} onChange={(event) => set('diet', event.target.value)}>
              <option value="">No label</option>
              <option>Vegetarian</option>
              <option>Vegan</option>
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea
            value={draft.description}
            maxLength={350}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>
        <label>
          Allergen information
          <input
            value={draft.allergens}
            maxLength={200}
            onChange={(event) => set('allergens', event.target.value)}
          />
        </label>
        <label>
          <span>
            <Image size={16} /> Image URL
          </span>
          <input
            type="url"
            value={draft.image}
            maxLength={500}
            onChange={(event) => set('image', event.target.value)}
            placeholder="https://…"
          />
        </label>
        <label>
          Menu badge (optional)
          <input
            value={draft.label || ''}
            onChange={(event) => set('label', event.target.value)}
            maxLength={35}
            placeholder="E.g. House favorite"
          />
        </label>
        <section className="editor-modifiers" aria-label="Choice groups">
          <h3>Choice groups</h3>
          <p>Set the minimum to zero for optional add-ons. Set the maximum to one for a single choice.</p>
          {draft.groups.map((group, index) => (
            <ChoiceGroup
              key={group.id}
              {...{ group, index }}
              update={(patch) => updateGroup(group.id, patch)}
              remove={() =>
                set(
                  'groups',
                  draft.groups.filter((item) => item.id !== group.id),
                )
              }
            />
          ))}
          <button
            type="button"
            className="secondary editor-add"
            disabled={draft.groups.length >= 8}
            onClick={() => set('groups', [...draft.groups, newGroup()])}
          >
            <Plus size={16} /> Add choice group
          </button>
        </section>
        {error && (
          <p className="dialog-feedback" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save dish'}
        </button>
      </form>
    </Dialog>
  )
}

export default function MenuWorkspace({ role, dishes, unavailable, version, busy, toggleDish, saveMenu }) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  async function archive(dish) {
    setError('')
    setUpdating(true)
    try {
      await saveMenu({ action: 'archive', id: dish.id, archived: !dish.archived, version })
    } catch (error) {
      setError(error.message)
    } finally {
      setUpdating(false)
    }
  }
  const manager = role === 'manager'
  const query = search.trim().toLowerCase()
  const visible = dishes.filter(
    (dish) => (manager || !dish.archived) && (dish.name + ' ' + dish.category).toLowerCase().includes(query),
  )
  return (
    <>
      <div className="workspace-title">
        <label className="menu-search catalog-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Find a dish"
            placeholder="Find a dish"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {manager && (
          <button className="primary" onClick={() => setEditor({ version })}>
            <Plus size={18} /> Add dish
          </button>
        )}
      </div>
      {error && (
        <p className="connection" role="alert">
          {error}
        </p>
      )}
      <div className="catalog">
        {visible.map((dish) => {
          const soldOut = unavailable.includes(dish.id)
          const groupCount = dish.groups?.length || 0
          return (
            <article className="menu-admin-card" key={dish.id}>
              {dish.image ? (
                <img src={dish.image} alt="" loading="lazy" />
              ) : (
                <span className="menu-image-placeholder">
                  <Utensils size={20} />
                </span>
              )}
              <div>
                <h3>{dish.name}</h3>
                <p>
                  {dish.category} · {money(dish.price)}
                </p>
                {groupCount > 0 && (
                  <p>
                    {groupCount} choice {groupCount === 1 ? 'group' : 'groups'}
                  </p>
                )}
                {dish.archived && <span className="status-chip">Archived</span>}
              </div>
              <div className="menu-admin-actions">
                {!dish.archived && (
                  <button
                    role="switch"
                    aria-label={dish.name + ' availability'}
                    aria-checked={!soldOut}
                    disabled={busy}
                    onClick={() => toggleDish(dish.id, soldOut)}
                  >
                    {soldOut ? 'Sold out' : 'Available'}
                  </button>
                )}
                {manager && (
                  <>
                    <button
                      className="icon-button"
                      aria-label={'Edit ' + dish.name}
                      onClick={() => setEditor({ dish, version })}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={(dish.archived ? 'Restore ' : 'Archive ') + dish.name}
                      disabled={busy || updating}
                      onClick={() => archive(dish)}
                    >
                      {dish.archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                    </button>
                  </>
                )}
              </div>
            </article>
          )
        })}
        {visible.length === 0 && <p className="empty-state">No dishes match this search.</p>}
      </div>
      {editor && <DishEditor editor={editor} close={() => setEditor(null)} save={saveMenu} />}
    </>
  )
}
