#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { labelFinder } from './labelFinder.js';

/**
 * CLI script to test labelFinder procedure with a sample data file and write results to an output file.
 * Usage: node labelFinderCli.js <input_file> <output_file>
 */
const main = async () => {
  try {
    // Get the file path from the command-line arguments
    const filePath = process.argv[2];
    const outputPath = process.argv[3];

    if (!filePath || !outputPath) {
      console.error('Usage: node labelFinderCli.js <input_file> <output_file>');
      process.exit(1);
    }

    // Read the input text file
    const inputText = await readFile(filePath, 'utf-8');

    const progressCallback = async (progress) => {
      console.log( progress );
      return;
    } 

    // Generate the graph object from the text
    const outputText = await labelFinder(inputText,{},progressCallback);

    // Write the resulting text to the output file
    await writeFile(outputPath, outputText, 'utf-8');
    console.log(`Output written to ${outputPath}`);
  } catch (error) {
    console.error(`Error processing file: ${error.message}`);
    process.exit(1);
  }
};

main();