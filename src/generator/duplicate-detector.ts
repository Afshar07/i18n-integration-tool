import { DuplicateCheckResult, TranslationEntry } from '../types';
import { logger } from '../utils';

/**
 * Duplicate detection system for translation keys and values
 */
export class DuplicateDetector {
  private translationData: Map<string, Map<string, string>> = new Map(); // locale -> key -> value
  private valueToKeys: Map<string, Map<string, string[]>> = new Map(); // locale -> value -> keys[]
  
  constructor() {
    this.initializeMaps();
  }

  /**
   * Initialize internal data structures
   */
  private initializeMaps(): void {
    this.translationData.clear();
    this.valueToKeys.clear();
  }

  /**
   * Load existing translation data from files
   */
  loadTranslationData(translationData: Record<string, Record<string, string>>): void {
    logger.info('Loading translation data for duplicate detection');
    
    this.initializeMaps();
    
    for (const [locale, translations] of Object.entries(translationData)) {
      const localeMap = new Map<string, string>();
      const valueMap = new Map<string, string[]>();
      
      for (const [key, value] of Object.entries(translations)) {
        localeMap.set(key, value);
        
        // Track values to keys mapping for duplicate value detection
        const normalizedValue = this.normalizeValue(value);
        if (!valueMap.has(normalizedValue)) {
          valueMap.set(normalizedValue, []);
        }
        valueMap.get(normalizedValue)!.push(key);
      }
      
      this.translationData.set(locale, localeMap);
      this.valueToKeys.set(locale, valueMap);
    }
    
    logger.info(`Loaded translations for ${this.translationData.size} locales`);
  }

  /**
   * Check if a key already exists in any locale
   */
  checkKeyDuplicate(key: string, locale?: string): DuplicateCheckResult {
    const locales = locale ? [locale] : Array.from(this.translationData.keys());
    
    for (const loc of locales) {
      const localeData = this.translationData.get(loc);
      if (localeData && localeData.has(key)) {
        return {
          isDuplicate: true,
          existingKey: key,
          similarKeys: this.findSimilarKeys(key, loc)
        };
      }
    }

    return {
      isDuplicate: false,
      similarKeys: this.findSimilarKeys(key, locale)
    };
  }

  /**
   * Check if a value already exists and suggest consolidation
   */
  checkValueDuplicate(value: string, locale: string): DuplicateCheckResult {
    const normalizedValue = this.normalizeValue(value);
    const valueMap = this.valueToKeys.get(locale);
    
    if (valueMap && valueMap.has(normalizedValue)) {
      const existingKeys = valueMap.get(normalizedValue)!;
      
      return {
        isDuplicate: true,
        existingKey: existingKeys[0], // Return first existing key
        similarKeys: existingKeys
      };
    }

    return {
      isDuplicate: false,
      similarKeys: this.findSimilarValues(value, locale)
    };
  }

  /**
   * Add a new translation entry to the tracking system
   */
  addTranslationEntry(entry: TranslationEntry): void {
    const { key, value, locale } = entry;
    
    // Add to translation data
    if (!this.translationData.has(locale)) {
      this.translationData.set(locale, new Map());
      this.valueToKeys.set(locale, new Map());
    }
    
    const localeData = this.translationData.get(locale)!;
    const valueMap = this.valueToKeys.get(locale)!;
    
    localeData.set(key, value);
    
    // Update value to keys mapping
    const normalizedValue = this.normalizeValue(value);
    if (!valueMap.has(normalizedValue)) {
      valueMap.set(normalizedValue, []);
    }
    valueMap.get(normalizedValue)!.push(key);
    
    logger.debug(`Added translation entry: ${locale}.${key} = "${value}"`);
  }

  /**
   * Find keys similar to the given key
   */
  private findSimilarKeys(targetKey: string, locale?: string): string[] {
    const similarKeys: string[] = [];
    const locales = locale ? [locale] : Array.from(this.translationData.keys());
    
    for (const loc of locales) {
      const localeData = this.translationData.get(loc);
      if (!localeData) continue;
      
      for (const key of localeData.keys()) {
        if (this.calculateSimilarity(targetKey, key) > 0.7) {
          similarKeys.push(key);
        }
      }
    }
    
    return similarKeys.slice(0, 5); // Return top 5 similar keys
  }

  /**
   * Find values similar to the given value
   */
  private findSimilarValues(targetValue: string, locale: string): string[] {
    const similarKeys: string[] = [];
    const localeData = this.translationData.get(locale);
    
    if (!localeData) return similarKeys;
    
    const normalizedTarget = this.normalizeValue(targetValue);
    
    for (const [key, value] of localeData.entries()) {
      const normalizedValue = this.normalizeValue(value);
      if (this.calculateSimilarity(normalizedTarget, normalizedValue) > 0.8) {
        similarKeys.push(key);
      }
    }
    
    return similarKeys.slice(0, 5); // Return top 5 similar values
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return 1 - (matrix[len1][len2] / maxLen);
  }

  /**
   * Normalize value for comparison (remove extra spaces, convert to lowercase)
   */
  private normalizeValue(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\w]/g, ''); // Keep only letters, Persian/Arabic, and spaces
  }

  /**
   * Generate contextual suffix for conflicting keys
   */
  generateContextualSuffix(baseKey: string, context: string): string {
    const contextSuffix = context
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
    
    return contextSuffix ? `${baseKey}_${contextSuffix}` : `${baseKey}_alt`;
  }

  /**
   * Get all duplicate values in a locale
   */
  getDuplicateValues(locale: string): Array<{ value: string; keys: string[] }> {
    const duplicates: Array<{ value: string; keys: string[] }> = [];
    const valueMap = this.valueToKeys.get(locale);
    
    if (!valueMap) return duplicates;
    
    for (const [value, keys] of valueMap.entries()) {
      if (keys.length > 1) {
        duplicates.push({ value, keys: [...keys] });
      }
    }
    
    return duplicates;
  }

  /**
   * Get statistics about duplicates
   */
  getDuplicateStats(): Record<string, { totalKeys: number; duplicateValues: number; duplicateKeys: number }> {
    const stats: Record<string, { totalKeys: number; duplicateValues: number; duplicateKeys: number }> = {};
    
    for (const [locale, valueMap] of this.valueToKeys.entries()) {
      const localeData = this.translationData.get(locale);
      const totalKeys = localeData ? localeData.size : 0;
      
      let duplicateValues = 0;
      let duplicateKeys = 0;
      
      for (const keys of valueMap.values()) {
        if (keys.length > 1) {
          duplicateValues++;
          duplicateKeys += keys.length - 1; // Count extra keys as duplicates
        }
      }
      
      stats[locale] = {
        totalKeys,
        duplicateValues,
        duplicateKeys
      };
    }
    
    return stats;
  }

  /**
   * Clear all loaded data
   */
  clear(): void {
    this.initializeMaps();
    logger.debug('Cleared duplicate detector data');
  }
}