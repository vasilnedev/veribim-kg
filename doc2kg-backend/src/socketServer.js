import { Server } from 'socket.io'
import IORedis from 'ioredis'
import config from './config.json' with { type: 'json' }

const { REDIS_CONFIG , GRAPH_PROGRESS_CHANNEL } = config

export let io

export const initSocket = (server) => {
  io = new Server(server, {
    path: '/doc2kg-backend/socket.io',
    cors: {
      origin: "*",
    }
  })

  // Handle client connections and room joining
  io.on('connection', (socket) => {
    const { userId } = socket.handshake.query
    if (userId && typeof userId === 'string') {
      socket.join(userId)
      console.log(`Socket client with user ID ${userId} connected and joined room.`)
    }

    socket.on('disconnect', () => {
      if (userId) {
        console.log(`Socket client with user ID ${userId} disconnected.`)
      }
    })
  })

  // Subscribe to Redis for progress updates from workers
  const subscriber = new IORedis(REDIS_CONFIG)
  subscriber.subscribe(GRAPH_PROGRESS_CHANNEL, (err) => {
    if (err) console.error('Failed to subscribe to Redis channel:', err)
    else console.log(`Subscribed to Redis channel "${GRAPH_PROGRESS_CHANNEL}" for progress updates.`)
  })

  // Forward messages from Redis to the appropriate client room
  subscriber.on('message', (channel, message) => {
    if (channel === GRAPH_PROGRESS_CHANNEL) {
      const { userId, payload } = JSON.parse(message)
      if (userId && payload) io.to(userId).emit('graph-progress', payload) // Must use the same io channel in doc2kg-frontend graphToolbar.js
    }
  })
}