/**
 * CLI components and utilities
 * Exports all command-line interface related functionality
 */

// Main CLI class
export { CLI } from './cli';

// Progress reporting utilities
export { 
  ProgressReporter, 
  Spinner, 
  TableFormatter 
} from './progress';

// Input/Output utilities
export { 
  IOUtils, 
  PromptUtils 
} from './io-utils';

// Re-export types that CLI components use
export type { 
  I18nIntegrationConfig,
  ScanResult,
  GeneratedKey,
  TransformationResult,
  ValidationResult,
  ProcessingState
} from '../types';