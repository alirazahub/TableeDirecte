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

let feed
export function startChangeFeed() {
  if (!process.env.MONGODB_URI) return Promise.resolve()
  if (feed) return feed
  feed = database().then(async collection => {
    const stream = collection.watch(
      [{$match:{operationType:{$in:['insert','replace','update','delete']}}}],
      {fullDocument:'updateLookup',maxAwaitTimeMS:1000}
    )
    const publish = event => changes.emit('change',String(event.documentKey._id),event.fullDocument)
    try {
      const first = await stream.tryNext()
      if (first) publish(first)
    } catch (error) {
      await stream.close().catch(() => {})
      throw error
    }
    void (async () => {
      try {
        for await (const event of stream) publish(event)
      } finally {await stream.close().catch(() => {})}
    })().catch(() => {
      feed = undefined
      changes.emit('feed-error')
    })
  }).catch(error => {
    feed = undefined
    throw error
  })
  return feed
}

export async function closeDatabase() {
  if (clientPromise) await (await clientPromise).close()
}
