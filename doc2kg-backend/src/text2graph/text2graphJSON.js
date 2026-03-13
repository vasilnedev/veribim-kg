import axios from 'axios'
import config from '../config.json' with { type: 'json' }
import { EMBEDDING_LABELS , GROUPING_LABELS } from '../labels.js'

const { OLLAMA_EMBED_CONFIG } = config

/*
    Parses plain text with specific formatting into a graph structure of nodes and links.

    @param {string} inputText The plain text to process.
    @returns {Promise<{
        nodes: Array<object>, 
        links: Array<object>, 
        errors:<Boolean>, 
        error_messages:<String>
    }>} - a graph object containing nodes, links and errors.
*/

export const textToGraph = async (inputText, options = {}, progressCallback = null) => {
    let nodes = []
    let links = []
    let levels = [] // A stack to maintain parent nodes at each indentation level.
    let idCounter = 1
    let errors = false
    let error_messages = ''
    let rootFound = false

    const errorHandler = message => {
        errors = true
        error_messages = error_messages + message + '\n'
        console.error(message)
    }

    // Validate text input
    if (!inputText || typeof inputText !== 'string') {
        errorHandler('Invalid or missing input text')
        return { nodes, links , errors , error_messages }
    }

    // Split the blocks separated by two ore more new lines - each block is a node
    let blocks = inputText.split(/\n(?:\s*\n)+/).filter(b => b.trim() !== '')
    let totalBlocks = blocks.length

    if (progressCallback) {
        // Use await to handle potential async operations in the callback
        await progressCallback({ complete: 0, total: totalBlocks, stage: 'parsing' })
    }

    // Loop thorough the blocks
    for(let i=0; i<blocks.length; i++) {
        const block = blocks[i]
       
        // 1. Determine indentation level (2 spaces per level)
        const indentMatch = block.match(/^( *)/)
        const indent = indentMatch ? indentMatch[1].length : 0
        const level = Math.floor(indent / 2)

        // 2. Parse the first line for label and properties
        const lines = block.trim().split('\n')
        const firstLine = lines.shift() || ''
        const nodeInfoMatch = firstLine.match(/\(:(\w+)\s*({.*})?\)/)

        if (!nodeInfoMatch) {
            errorHandler(`Skipping block due to invalid first line format: ${firstLine}`)
            continue
        }

        // 3. Determine the label
        const label = nodeInfoMatch[1]
        if(!EMBEDDING_LABELS.includes(label) && !GROUPING_LABELS.includes(label)){
            errorHandler(`Skipping block due to invalid label: ${firstLine}`)
            continue
        }

        if(levels.length == 0 && label != 'Document') {
            errorHandler(`First block must be a Document node. Found: ${firstLine}`)
            return { nodes, links , errors , error_messages }
        }

        // 4. Determine the properties
        const propertiesString = nodeInfoMatch[2] || '{}'
        let properties = {}
        try {
            properties = JSON.parse(propertiesString)
        } catch (e) {
            errorHandler(`Skipping block properties due to invalid JSON in: ${firstLine}`)
        }

        // 5. Split References and Definitions to individual nodes
        if(GROUPING_LABELS.includes(label)){
            const indentString = " ".repeat(level * 2);
            for(let line of lines){
                const newBlock = `${indentString}(:${label.slice(0,-1)} ${propertiesString})\n${line}`
                blocks.splice(i + 1, 0, newBlock); // Add a new block for each line
                totalBlocks++;
            }
            continue // Skip this block as new blocks were added for each line
        }

        // 6. Determine the node text and create the node object
        const text = lines.join('\n').trim()
        const currentNode = {
            id: idCounter++,
            label,
            ...properties,
            text
        }

        // 7. Determine the hierarchy
        let parentNode = null
        if(label == 'Document'){
            if(!rootFound){
                rootFound = true
            }else{
                errorHandler(`An incorrect Document node found at: ${firstLine}`)
                return { nodes, links , errors , error_messages }
            }

            if(level==0){ 
                levels[0]=currentNode
            }else{
                errorHandler(`The Document node must be at level 0 at: ${firstLine}`)
                return { nodes, links , errors , error_messages }                
            } 
        }
        else if(label == 'Section'){
            if(level > 0 && level <= levels.length){
                levels.slice(0,level-1)
                levels[level]=currentNode
                parentNode = levels[level-1]
            }else{
                errorHandler(`The level of a Section must be greater than 0 and less than current level plus one at: ${firstLine}`)
                parentNode = levels[0]
            }
        }else{
            if(level < levels.length){ 
                levels.slice(0,level)
                parentNode = levels[level]
            }else{
                errorHandler(`The level is greater than expected at: ${firstLine}`)
                parentNode = levels[0]                
            }
        } 

        // 8. Generate embedding for Document, Information, Requirment and Guidance nodes
        if(options && options.createEmbeddings && EMBEDDING_LABELS.includes(label)){
            const parentTexts = levels.map(p => p.text).filter(t => t).join('\n')
            const textForEmbedding = [parentTexts, currentNode.text].filter(t => t).join('\n')
            try {
                if (textForEmbedding) {
                    const embeddingResponse = await axios.post(OLLAMA_EMBED_CONFIG.url, {
                        model: OLLAMA_EMBED_CONFIG.model,
                        input: textForEmbedding,
                        stream: false
                    })
                    currentNode.embedding = embeddingResponse.data.embeddings[0] || []
                } else {
                    currentNode.embedding = []
                }
            } catch (error) {
                errorHandler(`Failed to generate embedding for node: ${firstLine}. Error: ${error.message}`)
                currentNode.embedding = []
            }
        }

        // 9. Add the new node and link
        nodes.push(currentNode)
        if (parentNode) {
            links.push({
                source: parentNode.id,
                target: currentNode.id,
                label: 'HAS'
            })
        }

        if (progressCallback) {
            await progressCallback({ complete: i + 1, total: totalBlocks, stage: 'parsing' })
        }
    }

    return { nodes, links , errors , error_messages }
}