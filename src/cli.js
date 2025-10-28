#!/usr/bin/env node

/**
 * CLI entry point for the i18n integration tool
 */

const { CLI } = require('./dist/cli/cli');

async function main() {
  try {
    const cli = new CLI();
    await cli.run(process.argv);
  } catch (error) {
    console.error('Error running CLI:', error.message);
    process.exit(1);
  }
}

main();