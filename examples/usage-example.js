#!/usr/bin/env node

/**
 * Example: Using i18n-integration-tool in another project
 */

const { 
  WorkflowOrchestrator, 
  ConfigManager, 
  FileScanner,
  ReportGenerator 
} = require('../dist/index.js');

async function processExternalProject() {
  try {
    console.log('🚀 Starting i18n integration for external project...');
    
    // 1. Create and configure the tool
    const configManager = new ConfigManager();
    
    // Load default config or create new one
    await configManager.load();
    
    // Override configuration for your specific project
    configManager.updateConfig({
      sourceDirectories: [
        './src/components',
        './src/views', 
        './src/router',
        './src/store'
      ],
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      locales: {
        source: 'fa', // Persian
        target: 'en'  // English
      },
      translationFiles: {
        directory: './src/locales',
        format: 'json'
      },
      fileProcessing: {
        createBackups: true,
        dryRun: false // Set to true for testing
      }
    });
    
    // 2. Run the complete workflow
    const orchestrator = new WorkflowOrchestrator(configManager);
    
    const result = await orchestrator.executeWorkflow({
      skipValidation: false,
      interactive: false,
      continueOnError: false,
      saveIntermediateResults: true,
      outputDirectory: './i18n-results'
    });
    
    // 3. Generate and save detailed report
    const reportPath = await ReportGenerator.saveReport(result, {
      format: 'html',
      outputPath: './i18n-integration-report.html',
      includeDetails: true,
      includeStatistics: true,
      includeRecommendations: true
    });
    
    // 4. Show results
    console.log('\n' + '='.repeat(50));
    console.log('📊 INTEGRATION RESULTS');
    console.log('='.repeat(50));
    
    if (result.success) {
      console.log('✅ Integration completed successfully!');
      console.log(`📁 Files processed: ${result.processedFiles}`);
      console.log(`🔍 Text matches found: ${result.scanResult?.matches.length || 0}`);
      console.log(`🔑 Keys generated: ${result.generatedKeys?.length || 0}`);
      console.log(`🔄 Files transformed: ${result.transformationResults?.length || 0}`);
      console.log(`⏱️  Execution time: ${result.executionTime}ms`);
      console.log(`📋 Detailed report: ${reportPath}`);
    } else {
      console.log('❌ Integration failed with errors:');
      result.errors.forEach(error => {
        console.log(`   • ${error.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Failed to process project:', error.message);
    process.exit(1);
  }
}

// Example: Scan only (without transformation)
async function scanOnly() {
  try {
    console.log('🔍 Scanning project for Persian/Arabic text...');
    
    const scanner = new FileScanner({
      directories: ['./src'],
      includePatterns: ['**/*.{vue,js,ts,jsx,tsx}'],
      excludePatterns: ['**/*.test.*', 'node_modules/**']
    });
    
    const scanResult = await scanner.scan();
    
    console.log(`📊 Scan Results:`);
    console.log(`   Files scanned: ${scanResult.processedFiles}`);
    console.log(`   Text matches: ${scanResult.matches.length}`);
    console.log(`   Errors: ${scanResult.errors.length}`);
    
    // Save results
    const fs = require('fs').promises;
    await fs.writeFile('./scan-results.json', JSON.stringify(scanResult, null, 2));
    console.log('💾 Results saved to scan-results.json');
    
  } catch (error) {
    console.error('💥 Scan failed:', error.message);
  }
}

// Run based on command line argument
const command = process.argv[2];

if (command === 'scan') {
  scanOnly();
} else {
  processExternalProject();
}