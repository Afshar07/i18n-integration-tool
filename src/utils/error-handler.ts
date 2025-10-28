import { 
  ProcessingError, 
  FileSystemError, 
  ParsingError, 
  TranslationError, 
  IntegrationError,
  ErrorReport 
} from '../types';
import { logger } from './logger';

/**
 * Error handling utilities for the i18n integration tool
 */
export class ErrorHandler {
  private errors: ProcessingError[] = [];

  /**
   * Handle file system errors
   */
  handleFileSystemError(error: FileSystemError): void {
    logger.error(`File system error: ${error.message}`, error);
    
    // Provide specific guidance based on error code
    switch (error.code) {
      case 'ENOENT':
        logger.warn(`File or directory not found: ${error.path}`);
        logger.info('Suggestion: Check if the path exists and is accessible');
        break;
      case 'EACCES':
        logger.warn(`Permission denied: ${error.path}`);
        logger.info('Suggestion: Check file permissions or run with appropriate privileges');
        break;
      case 'ENOSPC':
        logger.warn('No space left on device');
        logger.info('Suggestion: Free up disk space and try again');
        break;
      default:
        logger.warn(`Unexpected file system error: ${error.code}`);
    }

    this.errors.push(error);
  }

  /**
   * Handle parsing errors
   */
  handleParsingError(error: ParsingError): void {
    logger.error(`Parsing error in ${error.filePath}: ${error.message}`, error);
    
    if (error.lineNumber && error.columnNumber) {
      logger.info(`Location: Line ${error.lineNumber}, Column ${error.columnNumber}`);
    }
    
    logger.info('Suggestion: Check file syntax and encoding');
    this.errors.push(error);
  }

  /**
   * Handle translation errors
   */
  handleTranslationError(error: TranslationError): void {
    logger.error(`Translation error: ${error.message}`, error);
    
    if (error.key) {
      logger.info(`Related key: ${error.key}`);
    }
    
    if (error.locale) {
      logger.info(`Related locale: ${error.locale}`);
    }
    
    logger.info('Suggestion: Check translation key format and locale configuration');
    this.errors.push(error);
  }

  /**
   * Handle integration errors
   */
  handleIntegrationError(error: IntegrationError): void {
    logger.error(`Integration error in ${error.component}: ${error.message}`, error);
    logger.info(`Details: ${error.details}`);
    logger.info('Suggestion: Check component configuration and dependencies');
    this.errors.push(error);
  }

  /**
   * Handle any processing error
   */
  handleError(error: ProcessingError): void {
    if (this.isFileSystemError(error)) {
      this.handleFileSystemError(error);
    } else if (this.isParsingError(error)) {
      this.handleParsingError(error);
    } else if (this.isTranslationError(error)) {
      this.handleTranslationError(error);
    } else if (this.isIntegrationError(error)) {
      this.handleIntegrationError(error);
    } else {
      logger.error(`Unknown error: ${(error as Error).message}`, error as Error);
      this.errors.push(error);
    }
  }

  /**
   * Type guards for error types
   */
  private isFileSystemError(error: ProcessingError): error is FileSystemError {
    return 'code' in error && 'path' in error;
  }

  private isParsingError(error: ProcessingError): error is ParsingError {
    return 'filePath' in error;
  }

  private isTranslationError(error: ProcessingError): error is TranslationError {
    return 'key' in error || 'locale' in error;
  }

  private isIntegrationError(error: ProcessingError): error is IntegrationError {
    return 'component' in error && 'details' in error;
  }

  /**
   * Get all collected errors
   */
  getErrors(): ProcessingError[] {
    return [...this.errors];
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get error count by type
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const error of this.errors) {
      const type = error.constructor.name;
      stats[type] = (stats[type] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Create comprehensive error report
   */
  createErrorReport(): ErrorReport {
    return {
      timestamp: new Date().toISOString(),
      totalErrors: this.errors.length,
      errorsByType: this.getErrorStats(),
      errors: this.getErrors(),
      suggestions: this.generateSuggestions()
    };
  }

  /**
   * Generate suggestions based on error patterns
   */
  private generateSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.getErrorStats();

    if (stats.FileSystemError > 0) {
      suggestions.push('Check file permissions and disk space');
      suggestions.push('Verify all file paths are correct and accessible');
    }

    if (stats.ParsingError > 0) {
      suggestions.push('Validate syntax in source files');
      suggestions.push('Check file encoding (should be UTF-8)');
    }

    if (stats.TranslationError > 0) {
      suggestions.push('Review translation key naming conventions');
      suggestions.push('Verify locale configuration');
    }

    if (stats.IntegrationError > 0) {
      suggestions.push('Check Nuxt.js and Vue.js component compatibility');
      suggestions.push('Verify i18n module configuration');
    }

    if (this.errors.length > 10) {
      suggestions.push('Consider running in smaller batches to isolate issues');
    }

    return suggestions;
  }

  /**
   * Attempt to recover from specific error types
   */
  static recoverFromFileError(error: FileSystemError): boolean {
    switch (error.code) {
      case 'ENOENT':
        // Could attempt to create missing directories
        logger.info('Attempting to create missing directory structure...');
        return false; // Would need actual implementation
      
      case 'EACCES':
        // Could suggest permission fixes
        logger.info('Permission issue detected. Please check file permissions.');
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Suggest fixes for common errors
   */
  static suggestFix(error: ProcessingError): string[] {
    const suggestions: string[] = [];

    if (error.message.includes('ENOENT')) {
      suggestions.push('Create the missing file or directory');
      suggestions.push('Check if the path is correct');
    }

    if (error.message.includes('permission')) {
      suggestions.push('Check file permissions');
      suggestions.push('Run with appropriate privileges');
    }

    if (error.message.includes('syntax')) {
      suggestions.push('Validate file syntax');
      suggestions.push('Check for encoding issues');
    }

    if (error.message.includes('duplicate')) {
      suggestions.push('Review duplicate keys in translation files');
      suggestions.push('Consider consolidating similar translations');
    }

    return suggestions;
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();