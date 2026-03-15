import { Worker } from "bullmq";
import neo4j from 'neo4j-driver';
import IORedis from 'ioredis';
import { connection } from "./graphQueue.js";
import config from '../config.json' with { type: 'json' };
import { getMinioClient, getObjectFromMinio } from '../dataProviders/dataProviderMinIO.js';
import { documentExists } from '../dataProviders/dataProviderNeo4j.js';
import { textToGraphJSON } from '../text2graph/text2graphJSON.js';

const { NEO4J_CONFIG, REDIS_CONFIG, PROGRESS_CHANNEL , GRAPH_QUEUES } = config;

// Create a new Redis client for publishing events.
const publisher = new IORedis({
  ...REDIS_CONFIG,
  maxRetriesPerRequest: null
});

new Worker(
  GRAPH_QUEUES, // Must match the queue name in graphQueue.js
  async (job) => {
    // Assuming job.data contains docId and a userId for socket communication.
    const { docId, userId } = job.data;

    if (!userId) {
      console.error(`Job ${job.id} is missing a userId. Cannot report progress.`);
    }

    const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password));
    const session = driver.session();

    try {
      if (userId) {
        const event = { userId, payload: { docId, status: 'started', message: 'Job started.' } };
        await publisher.publish(PROGRESS_CHANNEL, JSON.stringify(event));
      }

      // 1. Get text from MinIO
      const minioClient = getMinioClient();
      const textContent = await getObjectFromMinio(minioClient, `${docId}.txt`, 'utf-8');
      if (textContent === null) {
        throw new Error(`Text file for document ID '${docId}' not found.`);
      }

      // 2. Define progress callback for textToGraphJSON
      const progressCallback = async (progress) => {
        const { complete, total } = progress;
        const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;
        await job.updateProgress(percentage);
        if (userId) {
          const event = { userId, payload: { docId, status: 'processing', message: `Parsing blocks...`, complete, total, percentage } };
          await publisher.publish(PROGRESS_CHANNEL, JSON.stringify(event));
        }
      };

      // 3. Run textToGraphJSON (slow process, which generates LLM embeddings) and update progress (in percentage form)
      const graph = await textToGraphJSON(textContent, { createEmbeddings: true }, progressCallback);

      if (graph.errors) {
        throw new Error(`Graph generation failed: ${graph.error_messages}`);
      }

      // 4. Import to DB
      if (userId) {
        const event = { userId, payload: { docId, status: 'importing', message: 'Importing graph to database...' } };
        await publisher.publish(PROGRESS_CHANNEL, JSON.stringify(event));
      }

      if (!await documentExists(session, docId)) {
        throw new Error(`Document with ID '${docId}' not found in database.`);
      }

      // Delete old graph data
      await session.run(`MATCH (d:Document { doc_id: $docId }) OPTIONAL MATCH (d)-[:HAS*]->(n) DETACH DELETE n`, { docId });

      // Update root node
      const rootNode = graph.nodes.find(n => n.label === 'Document');
      if (!rootNode) throw new Error('Generated graph does not contain a Document node');
      const { id: rootId, label: rootLabel, ...rootProps } = rootNode;
      await session.run(`MATCH (d:Document { doc_id: $docId }) SET d += $props, d.temp_id = $tempId`, { docId, props: rootProps, tempId: rootId });

      // Insert other nodes
      const otherNodes = graph.nodes.filter(n => n.label !== 'Document');
      const labels = [...new Set(otherNodes.map(n => n.label))];
      for (const label of labels) {
        const nodesToInsert = otherNodes.filter(n => n.label === label).map(n => { const { id, label: l, ...props } = n; return { ...props, temp_id: id }; });
        if (nodesToInsert.length > 0) await session.run(`UNWIND $batch AS row CREATE (n:\`${label}\`) SET n += row`, { batch: nodesToInsert });
      }

      // Create relationships
      if (graph.links.length > 0) await session.run(`UNWIND $links AS link MATCH (s), (t) WHERE s.temp_id = link.source AND t.temp_id = link.target MERGE (s)-[:HAS]->(t)`, { links: graph.links });

      // Remove temp_id
      await session.run(`MATCH (d:Document { doc_id: $docId }) OPTIONAL MATCH (d)-[:HAS*0..]->(n) REMOVE n.temp_id`, { docId });

      if (userId) {
        const event = { userId, payload: { docId, status: 'completed', message: 'Graph processing complete.' } };
        await publisher.publish(PROGRESS_CHANNEL, JSON.stringify(event));
      }

      return { status: "completed", docId };

    } catch (error) {
      console.error(`Job ${job.id} for doc ${docId} failed:`, error);
      if (userId) {
        const event = { userId, payload: { docId, status: 'failed', error: error.message } };
        await publisher.publish(PROGRESS_CHANNEL, JSON.stringify(event));
      }
      throw error; // Re-throw to mark job as failed in BullMQ
    } finally {
      await session.close();
      await driver.close();
    }
  },
  { connection }
);