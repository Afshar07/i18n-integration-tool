import { I18nIntegrationConfig, DuplicateCheckResult } from '../types';
import { JSONManager } from './json-manager';
import { logger } from '../utils';

export interface DuplicateValue {
  value: string;
  keys: string[];
  locales: string[];
}

export interface ConsolidationDecision {
  action: 'consolidate' | 'keep_separate' | 'rename';
  targetKey?: string;
  newKey?: string;
}

export interface DuplicateValueReport {
  totalDuplicates: number;
  duplicatesByLocale: Record<string, DuplicateValue[]>;
  suggestions: string[];
}

/**
 * Duplicate value detection system for translation files
 */
export class DuplicateValueDetector {
  private jsonManager: JSONManager;

  constructor(private config: I18nIntegrationConfig) {
    this.jsonManager = new JSONManager(config);
  }

  /**
   * Scan translation files for identical values
   */
  async scanForDuplicateValues(): Promise<DuplicateValueReport> {
    const report: DuplicateValueReport = {
      totalDuplicates: 0,
      duplicatesByLocale: {},
      suggestions: []
    };

    try {
      const locales = [this.config.locales.source, this.config.locales.target];
      
      for (const locale of locales) {
        const duplicates = await this.findDuplicatesInLocale(locale);
        
        if (duplicates.length > 0) {
          report.duplicatesByLocale[locale] = duplicates;
          report.totalDuplicates += duplicates.length;
          
          // Add suggestions for this locale
          report.suggestions.push(
            `Found ${duplicates.length} duplicate values in ${locale} locale`
          );
        }
      }

      if (report.totalDuplicates > 0) {
        report.suggestions.push(
          'Consider consolidating duplicate translations to reduce file size and improve maintainability'
        );
      }

      logger.info(`Duplicate scan complete. Found ${report.totalDuplicates} duplicates across all locales`);
      return report;
    } catch (error: any) {
      logger.error('Error scanning for duplicate values:', error);
      throw new Error(`Failed to scan for duplicates: ${error.message}`);
    }
  }

  /**
   * Check if a specific value already exists in translation files
   */
  async checkValueExists(value: string, locale: string): Promise<DuplicateCheckResult> {
    try {
      const translations = await this.jsonManager.readTranslationFile(locale);
      const existingKeys: string[] = [];
      
      // Find all keys with the same value
      for (const [key, translationValue] of Object.entries(translations)) {
        if (translationValue === value) {
          existingKeys.push(key);
        }
      }
      
      // Find similar values (for suggestions)
      const similarKeys = await this.findSimilarValues(value, locale);
      
      return {
        isDuplicate: existingKeys.length > 0,
        existingKey: existingKeys[0], // Return first match
        similarKeys: similarKeys.filter(key => !existingKeys.includes(key))
      };
    } catch (error: any) {
      logger.error(`Error checking value existence for locale ${locale}:`, error);
      return {
        isDuplicate: false,
        similarKeys: []
      };
    }
  }

  /**
   * Consolidate duplicate translations based on user decision
   */
  async consolidateDuplicates(
    locale: string,
    duplicateValue: DuplicateValue,
    decision: ConsolidationDecision
  ): Promise<void> {
    try {
      const translations = await this.jsonManager.readTranslationFile(locale);
      
      switch (decision.action) {
        case 'consolidate':
          await this.performConsolidation(locale, translations, duplicateValue, decision.targetKey!);
          break;
          
        case 'rename':
          await this.performRename(locale, translations, duplicateValue, decision.newKey!);
          break;
          
        case 'keep_separate':
          logger.info(`Keeping duplicate values separate for: ${duplicateValue.value}`);
          break;
          
        default:
          throw new Error(`Unknown consolidation action: ${decision.action}`);
      }
    } catch (error: any) {
      logger.error('Error consolidating duplicates:', error);
      throw new Error(`Failed to consolidate duplicates: ${error.message}`);
    }
  }

  /**
   * Get consolidation suggestions for duplicate values
   */
  async getConsolidationSuggestions(duplicateValue: DuplicateValue): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Suggest the shortest key as the target
    const sortedKeys = duplicateValue.keys.sort((a, b) => a.length - b.length);
    suggestions.push(`Consider using "${sortedKeys[0]}" as the primary key`);
    
    // Suggest semantic improvements
    if (duplicateValue.keys.some(key => key.includes('_'))) {
      suggestions.push('Consider using semantic key names that describe the context');
    }
    
    // Suggest grouping by context
    const contexts = this.extractContexts(duplicateValue.keys);
    if (contexts.length > 1) {
      suggestions.push(`Keys span multiple contexts: ${contexts.join(', ')}`);
    }
    
    return suggestions;
  }

  /**
   * Find duplicate values within a specific locale
   */
  private async findDuplicatesInLocale(locale: string): Promise<DuplicateValue[]> {
    try {
      const translations = await this.jsonManager.readTranslationFile(locale);
      const valueMap = new Map<string, string[]>();
      
      // Group keys by their values
      for (const [key, value] of Object.entries(translations)) {
        if (!valueMap.has(value)) {
          valueMap.set(value, []);
        }
        valueMap.get(value)!.push(key);
      }
      
      // Find values with multiple keys (duplicates)
      const duplicates: DuplicateValue[] = [];
      
      for (const [value, keys] of valueMap.entries()) {
        if (keys.length > 1) {
          duplicates.push({
            value,
            keys,
            locales: [locale]
          });
        }
      }
      
      return duplicates;
    } catch (error: any) {
      logger.error(`Error finding duplicates in locale ${locale}:`, error);
      return [];
    }
  }

  /**
   * Find similar values for suggestions
   */
  private async findSimilarValues(targetValue: string, locale: string): Promise<string[]> {
    try {
      const translations = await this.jsonManager.readTranslationFile(locale);
      const similarKeys: string[] = [];
      const targetLower = targetValue.toLowerCase().trim();
      
      for (const [key, value] of Object.entries(translations)) {
        const valueLower = value.toLowerCase().trim();
        
        // Check for partial matches or similar content
        if (valueLower.includes(targetLower) || targetLower.includes(valueLower)) {
          if (value !== targetValue) { // Exclude exact matches
            similarKeys.push(key);
          }
        }
      }
      
      return similarKeys.slice(0, 5); // Limit to 5 suggestions
    } catch (error: any) {
      logger.error(`Error finding similar values:`, error);
      return [];
    }
  }

  /**
   * Perform consolidation by removing duplicate keys and keeping target key
   */
  private async performConsolidation(
    locale: string,
    translations: Record<string, string>,
    duplicateValue: DuplicateValue,
    targetKey: string
  ): Promise<void> {
    // Ensure target key exists and has the correct value
    translations[targetKey] = duplicateValue.value;
    
    // Remove other duplicate keys
    for (const key of duplicateValue.keys) {
      if (key !== targetKey) {
        delete translations[key];
        logger.info(`Removed duplicate key: ${key}`);
      }
    }
    
    // Write updated translations
    await this.jsonManager.writeTranslationFile(locale, translations);
    
    logger.info(`Consolidated ${duplicateValue.keys.length - 1} duplicate keys into: ${targetKey}`);
  }

  /**
   * Perform rename operation for duplicate resolution
   */
  private async performRename(
    locale: string,
    translations: Record<string, string>,
    duplicateValue: DuplicateValue,
    newKey: string
  ): Promise<void> {
    // Add new key with the value
    translations[newKey] = duplicateValue.value;
    
    // Remove old keys
    for (const key of duplicateValue.keys) {
      delete translations[key];
      logger.info(`Removed old key: ${key}`);
    }
    
    // Write updated translations
    await this.jsonManager.writeTranslationFile(locale, translations);
    
    logger.info(`Renamed duplicate keys to: ${newKey}`);
  }

  /**
   * Extract contexts from key names (e.g., 'user_profile_name' -> 'user', 'profile')
   */
  private extractContexts(keys: string[]): string[] {
    const contexts = new Set<string>();
    
    for (const key of keys) {
      const parts = key.split('_');
      if (parts.length > 1) {
        contexts.add(parts[0]); // Add first part as context
      }
    }
    
    return Array.from(contexts);
  }
}