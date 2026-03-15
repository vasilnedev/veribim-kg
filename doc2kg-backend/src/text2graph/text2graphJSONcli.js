#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { textToGraphJSON } from './text2graphJSON.js';

/**
 * CLI script to test textToGraph procedure, which converts a formatted text into a graph JSON object.
 * Usage: node text2graphJSONcli.js <path_to_file> [createEmbeddings]
 */
const main = async () => {
  try {
    // Get the file path from the command-line arguments
    const filePath = process.argv[2];
    const createEmbeddings = process.argv[3] === 'true';

    if (!filePath) {
      console.error('Usage: node text2graphJSONcli.js <path_to_file> [createEmbeddings]');
      process.exit(1);
    }

    // Read the input text file
    const inputText = await readFile(filePath, 'utf-8');

    // Generate the graph object from the text
    const graph = await textToGraphJSON(inputText, { createEmbeddings });

    // Print the resulting graph JSON to the console
    console.log(JSON.stringify(graph, null, 2));
  } catch (error) {
    console.error(`Error processing file: ${error.message}`);
    process.exit(1);
  }
};

main();