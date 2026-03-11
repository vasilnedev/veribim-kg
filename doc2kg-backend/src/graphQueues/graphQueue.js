import config from '../config.json' with { type: 'json' }
import IORedis from "ioredis";
import { Queue } from "bullmq";

const { REDIS_CONFIG , GRAPH_QUEUES } = config

// BullMQ requires maxRetriesPerRequest to be null for blocking commands (e.g. BRPOP)
const redisOptions = {
  ...REDIS_CONFIG,
  maxRetriesPerRequest: null
}

export const connection = new IORedis(redisOptions)

export const graphQueue = new Queue(GRAPH_QUEUES, { connection })
