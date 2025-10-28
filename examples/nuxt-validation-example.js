#!/usr/bin/env node

/**
 * Example usage of Nuxt.js integration validator
 * 
 * This example demonstrates how to use the NuxtIntegrationValidator
 * to validate i18n integration in a Nuxt.js application.
 */

const { NuxtIntegrationValidator } = require('../dist/validator/nuxt-integration-validator');

// Example configuration
const config = {
  sourceDirectories: ['pages', 'components', 'layouts'],
  excludePatterns: ['node_modules/**', '.nuxt/**', 'dist/**'],
  locales: {
    source: 'fa',  // Persian as source
    target: 'en'   // English as target
  },
  keyGeneration: {
    strategy: 'semantic',
    maxLength: 50,
    useContext: true
  },
  fileProcessing: {
    createBackups: true,
    dryRun: false,
    batchSize: 10
  },
  translationFiles: {
    directory: 'assets/locales',
    format: 'json'
  }
};

async function validateNuxtIntegration() {
  console.log('🚀 Validating Nuxt.js i18n Integration...\n');

  try {
    // Initialize validator
    const validator = new NuxtIntegrationValidator(config, process.cwd());

    // Run validation with all tests enabled
    const result = await validator.validateNuxtIntegration({
      testLocaleSwitching: true,
      testFallbackMechanisms: true,
      testHotReloading: true,
      testTimeout: 30000,
      nuxtConfigPath: 'nuxt.config.ts',
      translationFilesPath: 'assets/locales'
    });

    // Display results
    console.log('📊 Validation Summary:');
    console.log(`   Status: ${result.isValid ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Nuxt Config: ${result.nuxtConfigValid ? '✅' : '❌'}`);
    console.log(`   i18n Module: ${result.i18nModuleConfigured ? '✅' : '❌'}`);
    console.log(`   Translation Files: ${result.translationFilesAccessible ? '✅' : '❌'}`);
    console.log(`   Dev Server: ${result.devServerStarted ? '✅' : '❌'}`);

    console.log('\n🧪 Individual Test Results:');
    result.testResults.forEach((test, index) => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${index + 1}. ${status} - ${test.testName} (${test.duration}ms)`);
      
      if (!test.passed && test.error) {
        console.log(`      ❌ ${test.error}`);
      }
      
      if (test.details) {
        console.log(`      ℹ️  Details: ${JSON.stringify(test.details, null, 2)}`);
      }
    });

    if (result.errors.length > 0) {
      console.log('\n❌ Errors Found:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    if (result.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      result.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (result.isValid) {
      console.log('🎉 Nuxt.js i18n integration validation completed successfully!');
      console.log('Your application is ready for internationalization.');
    } else {
      console.log('❌ Validation failed. Please address the issues above.');
      console.log('Run the validator again after making the necessary changes.');
    }

  } catch (error) {
    console.error('💥 Validation failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// CLI usage example
if (require.main === module) {
  validateNuxtIntegration();
}

module.exports = { validateNuxtIntegration };