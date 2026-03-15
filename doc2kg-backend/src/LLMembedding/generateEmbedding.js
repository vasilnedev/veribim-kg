import axios from 'axios'
import config from '../config.json' with { type: 'json' }

const { OLLAMA_EMBED_CONFIG } = config

export const generateEmbedding = async (text) => {
  const response = await axios.post(OLLAMA_EMBED_CONFIG.url, {
    model: OLLAMA_EMBED_CONFIG.model,
    input: text,
    stream: false
  })
  // The API response structure assumed from original code:
  // data.embeddings is an array of arrays, we take the first one.
  return response.data.embeddings[0] || []
}