import { logger } from '../utils';
import { ProcessingError, FileSystemError, ParsingError, TranslationError, IntegrationError } from '../types';

/**
 * Recovery strategy for different types of errors
 */
export interface RecoveryStrategy {
  canRecover: (error: ProcessingError) => boolean;
  recover: (error: ProcessingError) => Promise<RecoveryResult>;
  description: string;
}

/**
 * Result of a recovery attempt
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  suggestion?: string;
  retryable: boolean;
}

/**
 * Recovery options for error handling
 */
export interface RecoveryOptions {
  maxRetries: number;
  retryDelay: number;
  skipOnFailure: boolean;
  createBackups: boolean;
}

/**
 * Error recovery manager that handles graceful error recovery
 */
export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  private recoveryAttempts: Map<string, number> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    error: ProcessingError, 
    options: RecoveryOptions = this.getDefaultOptions()
  ): Promise<RecoveryResult> {
    const errorKey = this.getErrorKey(error);
    const attempts = this.recoveryAttempts.get(errorKey) || 0;

    // Check if we've exceeded max retries
    if (attempts >= options.maxRetries) {
      return {
        success: false,
        message: `Max recovery attempts (${options.maxRetries}) exceeded for error: ${error.message}`,
        retryable: false
      };
    }

    // Find applicable recovery strategy
    const strategy = this.findRecoveryStrategy(error);
    if (!strategy) {
      return {
        success: false,
        message: `No recovery strategy available for error type: ${error.constructor.name}`,
        suggestion: this.getSuggestionForError(error),
        retryable: false
      };
    }

    try {
      logger.info(`Attempting recovery for error: ${error.message} (attempt ${attempts + 1}/${options.maxRetries})`);
      
      // Wait before retry if specified
      if (attempts > 0 && options.retryDelay > 0) {
        await this.delay(options.retryDelay);
      }

      // Increment attempt counter
      this.recoveryAttempts.set(errorKey, attempts + 1);

      // Attempt recovery
      const result = await strategy.recover(error);
      
      if (result.success) {
        logger.info(`Recovery successful: ${result.message}`);
        this.recoveryAttempts.delete(errorKey); // Reset counter on success
      } else {
        logger.warn(`Recovery failed: ${result.message}`);
      }

      return result;

    } catch (recoveryError) {
      logger.error(`Recovery attempt failed: ${recoveryError}`);
      return {
        success: false,
        message: `Recovery attempt failed: ${recoveryError}`,
        retryable: true
      };
    }
  }

  /**
   * Check if an error is recoverable
   */
  isRecoverable(error: ProcessingError): boolean {
    return this.findRecoveryStrategy(error) !== null;
  }

  /**
   * Get recovery suggestions for an error
   */
  getRecoverySuggestions(error: ProcessingError): string[] {
    const suggestions: string[] = [];
    
    if (error instanceof FileSystemError) {
      suggestions.push('Check file permissions and disk space');
      suggestions.push('Ensure the file path is correct and accessible');
      if (error.code === 'ENOENT') {
        suggestions.push('Create the missing directory or file');
      }
    } else if (error instanceof ParsingError) {
      suggestions.push('Check file syntax and encoding');
      suggestions.push('Ensure the file is a valid JavaScript/TypeScript/Vue file');
      suggestions.push('Try excluding the problematic file from processing');
    } else if (error instanceof TranslationError) {
      suggestions.push('Check translation file format and structure');
      suggestions.push('Ensure all required translation keys are present');
      suggestions.push('Validate JSON syntax in translation files');
    } else if (error instanceof IntegrationError) {
      suggestions.push('Check Nuxt.js configuration and i18n module setup');
      suggestions.push('Ensure all required dependencies are installed');
      suggestions.push('Verify component integration and import statements');
    }

    return suggestions;
  }

  /**
   * Reset recovery attempts for all errors
   */
  resetRecoveryAttempts(): void {
    this.recoveryAttempts.clear();
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): { totalAttempts: number; activeErrors: number } {
    const totalAttempts = Array.from(this.recoveryAttempts.values()).reduce((sum, count) => sum + count, 0);
    return {
      totalAttempts,
      activeErrors: this.recoveryAttempts.size
    };
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    this.strategies = [
      // File system error recovery
      {
        canRecover: (error) => error instanceof FileSystemError,
        recover: async (error) => this.recoverFileSystemError(error as FileSystemError),
        description: 'File system error recovery'
      },

      // Parsing error recovery
      {
        canRecover: (error) => error instanceof ParsingError,
        recover: async (error) => this.recoverParsingError(error as ParsingError),
        description: 'Parsing error recovery'
      },

      // Translation error recovery
      {
        canRecover: (error) => error instanceof TranslationError,
        recover: async (error) => this.recoverTranslationError(error as TranslationError),
        description: 'Translation error recovery'
      },

      // Integration error recovery
      {
        canRecover: (error) => error instanceof IntegrationError,
        recover: async (error) => this.recoverIntegrationError(error as IntegrationError),
        description: 'Integration error recovery'
      }
    ];
  }

  /**
   * Find applicable recovery strategy for error
   */
  private findRecoveryStrategy(error: ProcessingError): RecoveryStrategy | null {
    return this.strategies.find(strategy => strategy.canRecover(error)) || null;
  }

  /**
   * Generate unique key for error tracking
   */
  private getErrorKey(error: ProcessingError): string {
    return `${error.constructor.name}:${error.message}`;
  }

  /**
   * Get default recovery options
   */
  private getDefaultOptions(): RecoveryOptions {
    return {
      maxRetries: 3,
      retryDelay: 1000,
      skipOnFailure: false,
      createBackups: true
    };
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get general suggestion for error type
   */
  private getSuggestionForError(error: ProcessingError): string {
    if (error instanceof FileSystemError) {
      return 'Check file permissions and ensure the path exists';
    } else if (error instanceof ParsingError) {
      return 'Verify file syntax and consider excluding problematic files';
    } else if (error instanceof TranslationError) {
      return 'Check translation file format and key consistency';
    } else if (error instanceof IntegrationError) {
      return 'Verify Nuxt.js and i18n module configuration';
    }
    return 'Review the error details and check system configuration';
  }

  /**
   * Recover from file system errors
   */
  private async recoverFileSystemError(error: FileSystemError): Promise<RecoveryResult> {
    switch (error.code) {
      case 'ENOENT':
        // Try to create missing directory
        try {
          const path = require('path');
          const fs = require('fs/promises');
          const dir = path.dirname(error.path);
          await fs.mkdir(dir, { recursive: true });
          
          return {
            success: true,
            message: `Created missing directory: ${dir}`,
            retryable: true
          };
        } catch (createError) {
          return {
            success: false,
            message: `Failed to create directory: ${createError}`,
            retryable: false
          };
        }

      case 'EACCES':
        return {
          success: false,
          message: 'Permission denied - cannot automatically fix',
          suggestion: 'Check file permissions and run with appropriate privileges',
          retryable: false
        };

      case 'ENOSPC':
        return {
          success: false,
          message: 'No space left on device - cannot automatically fix',
          suggestion: 'Free up disk space and retry',
          retryable: true
        };

      default:
        return {
          success: false,
          message: `Unknown file system error: ${error.code}`,
          retryable: false
        };
    }
  }

  /**
   * Recover from parsing errors
   */
  private async recoverParsingError(error: ParsingError): Promise<RecoveryResult> {
    // For parsing errors, we typically can't auto-fix the syntax
    // But we can suggest skipping the file or provide guidance
    
    return {
      success: false,
      message: 'Cannot automatically fix parsing errors',
      suggestion: `Consider excluding ${error.filePath} from processing or fix syntax errors manually`,
      retryable: false
    };
  }

  /**
   * Recover from translation errors
   */
  private async recoverTranslationError(error: TranslationError): Promise<RecoveryResult> {
    // Try to fix common translation file issues
    if (error.message.includes('JSON')) {
      return {
        success: false,
        message: 'Cannot automatically fix JSON syntax errors',
        suggestion: 'Validate and fix JSON syntax in translation files',
        retryable: false
      };
    }

    if (error.key && error.message.includes('duplicate')) {
      return {
        success: false,
        message: 'Cannot automatically resolve duplicate keys',
        suggestion: `Review and resolve duplicate key: ${error.key}`,
        retryable: false
      };
    }

    return {
      success: false,
      message: 'Unknown translation error',
      retryable: false
    };
  }

  /**
   * Recover from integration errors
   */
  private async recoverIntegrationError(error: IntegrationError): Promise<RecoveryResult> {
    if (error.component === 'nuxt-config') {
      return {
        success: false,
        message: 'Cannot automatically fix Nuxt configuration',
        suggestion: 'Check nuxt.config.ts and @nuxtjs/i18n module configuration',
        retryable: false
      };
    }

    if (error.component === 'import') {
      return {
        success: false,
        message: 'Cannot automatically fix import issues',
        suggestion: 'Check import statements and module availability',
        retryable: false
      };
    }

    return {
      success: false,
      message: 'Unknown integration error',
      retryable: false
    };
  }
}