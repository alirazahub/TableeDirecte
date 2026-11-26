import { EventEmitter } from 'node:events'
import { MongoClient } from 'mongodb'

export const changes = new EventEmitter()
changes.setMaxListeners(0)
let clientPromise

export async function database() {
  if (!process.env.MONGODB_URI) return null
  clientPromise ??= MongoClient.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS:5000})
    .catch(error => {clientPromise = null; throw error})
  const client = await clientPromise
  return client.db(process.env.MONGODB_DATABASE || 'TableeDirecte').collection('tables')
}

let watchStarted = false
export function startChangeFeed() {
  if (watchStarted || !process.env.MONGODB_URI) return
  watchStarted = true
  const retry = () => {
    watchStarted = false
    const timer = setTimeout(startChangeFeed,5000)
    timer.unref?.()
  }
  database().then(collection => {
    const stream = collection.watch([{ $match:{operationType:{$in:['insert','replace','update','delete']}} }])
    stream.on('change', event => changes.emit('change',String(event.documentKey._id)))
    stream.once('error', () => {void stream.close().catch(() => {}); retry()})
  }).catch(retry)
}

export async function closeDatabase() {
  if (clientPromise) await (await clientPromise).close()
}
