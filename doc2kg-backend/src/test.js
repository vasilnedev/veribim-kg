import config from './config.json' with { type: 'json' }
import { Client as MinioClient } from 'minio'
import neo4j from 'neo4j-driver'
import axios from 'axios'

// Destructure config
const { 
  MINIO_CONFIG,
  BUCKET_NAME,
  NEO4J_CONFIG, 
  OLLAMA_GENERATE_CONFIG, 
  OLLAMA_EMBED_CONFIG
} = config

    // Check if already in the database
    const driver = neo4j.driver(
      NEO4J_CONFIG.uri, 
      neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password)
    )
    const session = driver.session()
    const docId = 'some-doc-id' // Replace with actual docId to check
    try {
      const result = await session.run(`MATCH (d:Document { doc_id: $docId }) RETURN d`,{ docId })
      if (result.records.length > 0) {
        const document = result.records[0].get('d')
        console.log(document.properties) // Access document data
      } else {
        console.log('Document not found')
      }
    } finally {
      await session.close();
      await driver.close();
    }

    // Initialize MinIO client and upload files
    const minioClient = new MinioClient(MINIO_CONFIG);

    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    console.log(`Bucket ${BUCKET_NAME} exists:`, bucketExists);

    // Extract metadata using LLM
    const prompt = `Are able to fix text parsed from PDF issues like removing repeated text from header and footer, copyright texts and unecessary line breaks?`;
    const response = await axios.post(OLLAMA_EMBED_CONFIG.url, {
      model: OLLAMA_EMBED_CONFIG.model,
      input: prompt,
      stream: false
    });
    console.log('LLM Response:', response.data.embeddings[0] );
