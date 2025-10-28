import { TranslationEntry, DuplicateCheckResult, I18nIntegrationConfig } from '../types';
import { logger } from '../utils';
import { JSONManager } from './json-manager';
import { BackupSystem } from './backup-system';
import { DuplicateValueDetector, DuplicateValueReport, ConsolidationDecision } from './duplicate-value-detector';

/**
 * Main translation manager that orchestrates all translation file operations
 */
export class TranslationManager {
  private jsonManager: JSONManager;
  private backupSystem: BackupSystem;
  private duplicateDetector: DuplicateValueDetector;

  constructor(private config: I18nIntegrationConfig) {
    this.jsonManager = new JSONManager(config);
    this.backupSystem = new BackupSystem(config);
    this.duplicateDetector = new DuplicateValueDetector(config);
  }

  /**
   * Add a new translation entry with backup and duplicate checking
   */
  async addTranslation(entry: TranslationEntry): Promise<void> {
    try {
      // Create backup before modification if enabled
      if (this.config.fileProcessing.createBackups) {
        await this.backupSystem.createBackup(`Before adding translation: ${entry.key}`);
      }

      // Check for duplicates
      const duplicateCheck = await this.checkDuplicate(entry.value, entry.locale);
      
      if (duplicateCheck.isDuplicate) {
        logger.warn(`Duplicate value detected for key "${entry.key}". Existing key: "${duplicateCheck.existingKey}"`);
      }

      // Add the translation
      await this.jsonManager.addTranslationEntry(entry);
      
      logger.info(`Successfully added translation: ${entry.key} = "${entry.value}" (${entry.locale})`);
    } catch (error: any) {
      logger.error('Error adding translation:', error);
      throw error;
    }
  }

  /**
   * Add multiple translation entries in batch
   */
  async addTranslations(entries: TranslationEntry[]): Promise<void> {
    try {
      // Create backup before batch operation
      if (this.config.fileProcessing.createBackups) {
        await this.backupSystem.createBackup(`Before adding ${entries.length} translations`);
      }

      // Group entries by locale for efficient processing
      const entriesByLocale = new Map<string, Record<string, string>>();
      
      for (const entry of entries) {
        if (!entriesByLocale.has(entry.locale)) {
          entriesByLocale.set(entry.locale, {});
        }
        entriesByLocale.get(entry.locale)![entry.key] = entry.value;
      }

      // Update each locale file
      for (const [locale, translations] of entriesByLocale.entries()) {
        await this.jsonManager.updateTranslationFile(locale, translations);
      }

      logger.info(`Successfully added ${entries.length} translations across ${entriesByLocale.size} locales`);
    } catch (error: any) {
      logger.error('Error adding translations in batch:', error);
      throw error;
    }
  }

  /**
   * Check if a value is a duplicate in the specified locale
   */
  async checkDuplicate(value: string, locale: string = this.config.locales.source): Promise<DuplicateCheckResult> {
    try {
      return await this.duplicateDetector.checkValueExists(value, locale);
    } catch (error: any) {
      logger.error('Error checking for duplicates:', error);
      return {
        isDuplicate: false,
        similarKeys: []
      };
    }
  }

  /**
   * Scan all translation files for duplicate values
   */
  async scanForDuplicates(): Promise<DuplicateValueReport> {
    try {
      return await this.duplicateDetector.scanForDuplicateValues();
    } catch (error: any) {
      logger.error('Error scanning for duplicates:', error);
      throw error;
    }
  }

  /**
   * Consolidate duplicate translations based on user decision
   */
  async consolidateDuplicates(
    locale: string,
    duplicateValue: any,
    decision: ConsolidationDecision
  ): Promise<void> {
    try {
      // Create backup before consolidation
      if (this.config.fileProcessing.createBackups) {
        await this.backupSystem.createBackup(`Before consolidating duplicates in ${locale}`);
      }

      await this.duplicateDetector.consolidateDuplicates(locale, duplicateValue, decision);
      
      logger.info(`Successfully consolidated duplicates in ${locale} locale`);
    } catch (error: any) {
      logger.error('Error consolidating duplicates:', error);
      throw error;
    }
  }

  /**
   * Get all translation keys for a locale
   */
  async getTranslationKeys(locale: string): Promise<string[]> {
    return await this.jsonManager.getTranslationKeys(locale);
  }

  /**
   * Get all translation values for a locale
   */
  async getTranslationValues(locale: string): Promise<string[]> {
    return await this.jsonManager.getTranslationValues(locale);
  }

  /**
   * Check if a key exists in translation file
   */
  async keyExists(locale: string, key: string): Promise<boolean> {
    return await this.jsonManager.keyExists(locale, key);
  }

  /**
   * Validate translation file structure and syntax
   */
  async validateTranslationFile(locale: string): Promise<{ isValid: boolean; errors: string[] }> {
    return await this.jsonManager.validateTranslationFile(locale);
  }

  /**
   * Create backup of current translation files
   */
  async createBackup(description?: string): Promise<string> {
    return await this.backupSystem.createBackup(description);
  }

  /**
   * Restore translation files from backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    return await this.backupSystem.restoreBackup(backupId);
  }

  /**
   * List all available backups
   */
  async listBackups() {
    return await this.backupSystem.listBackups();
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups(keepCount: number = 10): Promise<void> {
    return await this.backupSystem.cleanupOldBackups(keepCount);
  }

  /**
   * Read translation file content
   */
  async readTranslationFile(locale: string): Promise<Record<string, string>> {
    return await this.jsonManager.readTranslationFile(locale);
  }

  /**
   * Write translation file content
   */
  async writeTranslationFile(locale: string, translations: Record<string, string>): Promise<void> {
    // Create backup before writing if enabled
    if (this.config.fileProcessing.createBackups) {
      await this.backupSystem.createBackup(`Before writing ${locale} translation file`);
    }

    return await this.jsonManager.writeTranslationFile(locale, translations);
  }

  /**
   * Validate complete i18n integration using the comprehensive validation system
   */
  async validateIntegration(options: {
    checkKeys?: boolean;
    checkSyntax?: boolean;
    checkDuplicates?: boolean;
    checkReplacedStrings?: boolean;
    checkImports?: boolean;
  } = {}): Promise<{ isValid: boolean; errors: string[]; warnings: string[]; suggestions: string[] }> {
    logger.info('Starting comprehensive i18n integration validation');
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Default options
    const {
      checkKeys = true,
      checkSyntax = true,
      checkDuplicates = true,
      checkReplacedStrings = true,
      checkImports = true
    } = options;

    try {
      // Use the comprehensive validation system for source code validation
      if (checkReplacedStrings || checkKeys || checkSyntax || checkImports) {
        const { ValidationSystem } = await import('../validator');
        const validationSystem = new ValidationSystem(this.config);
        
        const comprehensiveResult = await validationSystem.validateIntegration({
          checkReplacedStrings,
          checkTranslationKeys: checkKeys,
          checkSyntax,
          checkImports
        });

        errors.push(...comprehensiveResult.errors);
        warnings.push(...comprehensiveResult.warnings);
        suggestions.push(...comprehensiveResult.suggestions);
      }

      // Check translation file syntax (legacy validation)
      if (checkSyntax) {
        const locales = [this.config.locales.source, this.config.locales.target];
        for (const locale of locales) {
          const validation = await this.validateTranslationFile(locale);
          if (!validation.isValid) {
            errors.push(...validation.errors.map(err => `Translation file ${locale}: ${err}`));
          }
        }
      }

      // Check for duplicate values in translation files
      if (checkDuplicates) {
        try {
          const duplicateReport = await this.duplicateDetector.scanForDuplicateValues();
          const duplicates = Object.values(duplicateReport.duplicatesByLocale).flat();
          if (duplicates.length > 0) {
            warnings.push(`Found ${duplicates.length} duplicate translation values`);
            suggestions.push('Consider consolidating duplicate translations to reduce file size');
          }
        } catch (error) {
          warnings.push(`Failed to check for duplicate values: ${error}`);
        }
      }

      // Additional translation file consistency checks
      if (checkKeys) {
        try {
          const sourceTranslations = await this.readTranslationFile(this.config.locales.source);
          const targetTranslations = await this.readTranslationFile(this.config.locales.target);
          
          const sourceKeys = new Set(Object.keys(sourceTranslations));
          const targetKeys = new Set(Object.keys(targetTranslations));
          
          // Check for keys in source but not in target
          const missingInTarget = [...sourceKeys].filter(key => !targetKeys.has(key));
          if (missingInTarget.length > 0) {
            errors.push(`Missing ${missingInTarget.length} keys in ${this.config.locales.target} translation file`);
          }
          
          // Check for keys in target but not in source
          const missingInSource = [...targetKeys].filter(key => !sourceKeys.has(key));
          if (missingInSource.length > 0) {
            warnings.push(`Found ${missingInSource.length} orphaned keys in ${this.config.locales.target} translation file`);
            suggestions.push('Remove orphaned translation keys to keep files clean');
          }
        } catch (error) {
          errors.push(`Failed to validate translation keys: ${error}`);
        }
      }

      const isValid = errors.length === 0;
      
      logger.info(`Validation completed: ${isValid ? '✅ PASSED' : '❌ FAILED'} (${errors.length} errors, ${warnings.length} warnings)`);
      
      return {
        isValid,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      logger.error('Validation failed with error:', error as Error);
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings,
        suggestions
      };
    }
  }
}