import { upgradeWebSocket } from '@vercel/functions'
import { attachSocket } from '../../../server/realtime.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket upgrade required',{status:426})
  const origin = request.headers.get('origin')
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  if (origin && origin !== 'https://' + host && origin !== 'http://' + host) return new Response('Invalid origin',{status:403})
  const cookie = request.headers.get('cookie')
  return upgradeWebSocket(ws => attachSocket(ws,cookie), {maxPayload:4096})
}
