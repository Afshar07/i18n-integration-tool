#!/usr/bin/env node

/**
 * Main entry point for the i18n integration CLI tool
 */

import { CLI } from './cli';

async function main() {
  try {
    const cli = new CLI();
    await cli.run(process.argv);
  } catch (error) {
    console.error('Error running CLI:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}