#!/usr/bin/env node

/**
 * Main entry point for the i18n integration tool
 */

export * from './types';
export * from './utils';

// Core components
export { TextScanner } from './scanner/text-scanner';
export { KeyGenerator, DuplicateDetector, KeyValidator, KeyManager } from './generator';
export { FileProcessor } from './processor/file-processor';
export { TranslationManager } from './manager/translation-manager';

// Validation system
export { ValidationSystem } from './validator';

// Workflow orchestration
export { WorkflowOrchestrator, ErrorRecoveryManager, ReportGenerator } from './orchestrator';

// CLI interface
export { CLI } from './cli/cli';