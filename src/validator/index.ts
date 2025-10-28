/**
 * Validation system components
 * Exports all validation-related functionality
 */

// Main validation system
export { 
  ValidationSystem,
  type ValidationOptions,
  type FileValidationResult,
  type ComprehensiveValidationResult
} from './validation-system';

// Nuxt.js integration validator
export {
  NuxtIntegrationValidator,
  type NuxtValidationOptions,
  type NuxtIntegrationResult,
  type NuxtValidationResult
} from './nuxt-integration-validator';

// Re-export types that validation components use
export type { 
  ValidationResult,
  TextMatch,
  TransformationResult
} from '../types';