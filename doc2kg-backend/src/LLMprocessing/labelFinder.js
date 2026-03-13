import config from '../config.json' with { type: 'json' }
import { EMBEDDING_LABELS , EMBEDDING_LABEL_DESCRIPTIONS } from '../labels.js'

const { OLLAMA_GENERATE_CONFIG } = config

/**
 * LLM call to identify a Label for a block of text.
 * @param {string} blockText - The text block to process.
 * @returns {Promise<string>} The processed label or null.
 */
const findLableForBlock = async (blockText) => {

  // If there is no content, return null
  if (!blockText.trim()) return null;
  
  // The prompt instructs the LLM to join sentences that have been split across lines.
  const prompt = `You are a document analyzer. Assign ONE of the following labels to the given text block based on its content and purpose.

LABELS WITH DESCRIPTIONS:
${EMBEDDING_LABEL_DESCRIPTIONS.join('\n')}

TEXT BLOCK:
"""
${blockText}
"""

Return ONLY the label name (i.e. ${EMBEDDING_LABELS.join(',')}) without any additional text or explanation.`;
  try {
    const response = await fetch(OLLAMA_GENERATE_CONFIG.url, {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
      },
      body: JSON.stringify({
          "model": OLLAMA_GENERATE_CONFIG.model,
          "prompt": prompt,
          "stream": false,
      }),
    });
    const data = await response.json();
    return data.response || null;
  } catch (error) {
      console.error("Error connecting to Ollama:", error);
      return null;
  }
}


/**
 * Splits input text into blocks, uses an LLM to fix split sentences within each block,
 * and then rejoins the blocks to form a corrected text.
 *
 * @param {string} inputText - The text to process.
 * @param {object} [options={}] - Options for future use.
 * @param {function(number): void} [progressCallback=null] - A function to call with progress updates (0-100).
 * @returns {Promise<string>} The processed text with sentences joined.
 */
export const labelFinder = async (inputText, options = {}, progressCallback = null) => {
    if (!inputText || typeof inputText !== 'string') {
        return '';
    }

    // Get all parts split by multiple new lines 
    const parts = inputText.split(/\n(?:\s*\n)+/).filter(b => b.trim() !== '');
    const processedParts = [];

    if(progressCallback){
      await progressCallback({ complete: 0, total: parts.length, stage: 'parsing' })
    }

    for (let i = 0; i < parts.length; i++) {
      let currentPart = parts[i];
      // Check current label and replace it with appropriate label using LLM processing
      if(currentPart.startsWith('(:Preliminary')){
        const proposedLabel = await findLableForBlock(currentPart.split('\n').slice(1).join('\n')); //Use LLM to find appropriate label
        console.log('Proposed label: '+ proposedLabel)
        if(EMBEDDING_LABELS.includes(proposedLabel)) currentPart = currentPart.replace('(:Preliminary','(:'+proposedLabel);
      }
      processedParts.push(currentPart);
      if(progressCallback){
        await progressCallback({ complete: i + 1, total: parts.length, stage: 'parsing' })
      }
    }

    // 4. Rejoin the processed parts to return the final text.
    return processedParts.join('\n\n');
}
