export async function restaurantApi(path, { tableKey, body } = {}) {
  const headers = new Headers()
  if (tableKey) headers.set('X-Table-Key', tableKey)
  if (body) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch('/service/' + path, {
      cache: 'no-store',
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the restaurant service. Try again.')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw Object.assign(new Error(data?.error || 'The restaurant service is unavailable.'), {
      status: response.status,
    })
  }
  return data
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export const money = (cents) => euros.format(cents / 100)
