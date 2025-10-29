import { KeyGenerator } from './key-generator';
import { DuplicateDetector } from './duplicate-detector';
import { KeyValidator, KeyValidationRules } from './key-validator';
import { GeneratedKey, KeyGenerationOptions, DuplicateCheckResult, ValidationResult, TranslationEntry } from '../types';
import { logger } from '../utils';

/**
 * Comprehensive key management system that integrates generation, validation, and duplicate detection
 */
export class KeyManager {
  private keyGenerator: KeyGenerator;
  private duplicateDetector: DuplicateDetector;
  private keyValidator: KeyValidator;

  constructor(
    generationOptions: KeyGenerationOptions,
    validationRules?: Partial<KeyValidationRules>
  ) {
    this.keyGenerator = new KeyGenerator(generationOptions);
    this.duplicateDetector = new DuplicateDetector();
    this.keyValidator = new KeyValidator(validationRules);
    
    logger.info('KeyManager initialized with generation and validation options');
  }

  /**
   * Generate, validate, and check for duplicates in one operation
   */
  async processTextForKey(
    text: string, 
    locale: string, 
    context?: string
  ): Promise<{
    generatedKey: GeneratedKey;
    validation: ValidationResult;
    duplicateCheck: DuplicateCheckResult;
    finalKey: string;
  }> {
    logger.info(`Processing text for key generation: "${text}"`);

    // Step 1: Generate initial key
    const generatedKey = this.keyGenerator.generateKey(text, context);
    
    // Step 2: Validate the generated key
    const validation = this.keyValidator.validateKey(generatedKey.key);
    
    // Step 3: Normalize key if validation failed
    let finalKey = generatedKey.key;
    if (!validation.isValid) {
      finalKey = this.keyValidator.normalizeKey(generatedKey.key);
      logger.info(`Key normalized from "${generatedKey.key}" to "${finalKey}"`);
    }

    // Step 4: Check for duplicates
    const keyDuplicateCheck = this.duplicateDetector.checkKeyDuplicate(finalKey, locale);
    const valueDuplicateCheck = this.duplicateDetector.checkValueDuplicate(text, locale);

    // Step 5: Handle duplicates
    if (keyDuplicateCheck.isDuplicate) {
      finalKey = this.handleKeyDuplicate(finalKey, context);
      logger.info(`Key conflict resolved: "${finalKey}"`);
    }

    // Step 6: Mark key as used
    this.keyValidator.markKeyAsUsed(finalKey);

    const result = {
      generatedKey: {
        ...generatedKey,
        key: finalKey
      },
      validation,
      duplicateCheck: {
        isDuplicate: keyDuplicateCheck.isDuplicate || valueDuplicateCheck.isDuplicate,
        existingKey: keyDuplicateCheck.existingKey || valueDuplicateCheck.existingKey,
        similarKeys: [...keyDuplicateCheck.similarKeys, ...valueDuplicateCheck.similarKeys]
      },
      finalKey
    };

    logger.info(`Key processing complete: "${finalKey}"`);
    return result;
  }

  /**
   * Load existing translation data for duplicate detection
   */
  loadExistingTranslations(translationData: Record<string, Record<string, string>>): void {
    logger.info('Loading existing translations into key manager');
    
    // Load into duplicate detector
    this.duplicateDetector.loadTranslationData(translationData);
    
    // Extract all keys for validator
    const allKeys: string[] = [];
    for (const localeData of Object.values(translationData)) {
      allKeys.push(...Object.keys(localeData));
    }
    
    this.keyValidator.addExistingKeys(allKeys);
    this.keyGenerator.addExistingKeys(allKeys);
    
    logger.info(`Loaded ${allKeys.length} existing keys`);
  }

  /**
   * Add a new translation entry to all tracking systems
   */
  addTranslationEntry(entry: TranslationEntry): void {
    this.duplicateDetector.addTranslationEntry(entry);
    this.keyValidator.markKeyAsUsed(entry.key);
    
    logger.debug(`Added translation entry: ${entry.locale}.${entry.key}`);
  }

  /**
   * Handle key duplicates by generating contextual alternatives
   */
  private handleKeyDuplicate(key: string, context?: string): string {
    if (context) {
      const contextualKey = this.duplicateDetector.generateContextualSuffix(key, context);
      if (!this.keyValidator.isKeyUsed(contextualKey)) {
        return contextualKey;
      }
    }

    // Generate numbered alternative
    let counter = 1;
    let alternativeKey = `${key}_${counter}`;
    
    while (this.keyValidator.isKeyUsed(alternativeKey)) {
      counter++;
      alternativeKey = `${key}_${counter}`;
    }
    
    return alternativeKey;
  }

  /**
   * Validate multiple keys at once
   */
  validateKeys(keys: string[]): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    
    for (const key of keys) {
      results[key] = this.keyValidator.validateKey(key);
    }
    
    return results;
  }

  /**
   * Get duplicate statistics for all locales
   */
  getDuplicateStatistics(): Record<string, { totalKeys: number; duplicateValues: number; duplicateKeys: number }> {
    return this.duplicateDetector.getDuplicateStats();
  }

  /**
   * Get all duplicate values for a specific locale
   */
  getDuplicateValues(locale: string): Array<{ value: string; keys: string[] }> {
    return this.duplicateDetector.getDuplicateValues(locale);
  }

  /**
   * Generate alternative keys for a given text
   */
  generateAlternativeKeys(text: string, context?: string, count: number = 3): GeneratedKey[] {
    const alternatives: GeneratedKey[] = [];
    
    // Generate primary key
    const primaryKey = this.keyGenerator.generateKey(text, context);
    alternatives.push(primaryKey);
    
    // Generate alternatives with different contexts
    const contexts = ['btn', 'label', 'title', 'msg', 'text'];
    for (const ctx of contexts) {
      if (alternatives.length >= count) break;
      if (ctx === context) continue;
      
      const altKey = this.keyGenerator.generateKey(text, ctx);
      if (!alternatives.some(k => k.key === altKey.key)) {
        alternatives.push(altKey);
      }
    }
    
    // Generate numbered alternatives if needed
    while (alternatives.length < count) {
      const baseKey = primaryKey.key;
      const numberedKey = `${baseKey}_${alternatives.length}`;
      
      alternatives.push({
        key: numberedKey,
        originalText: text,
        confidence: primaryKey.confidence * 0.8, // Lower confidence for numbered alternatives
        suggestions: []
      });
    }
    
    return alternatives.slice(0, count);
  }

  /**
   * Suggest consolidation for duplicate values
   */
  suggestConsolidation(locale: string): Array<{
    value: string;
    keys: string[];
    suggestedKey: string;
    confidence: number;
  }> {
    const duplicates = this.getDuplicateValues(locale);
    const suggestions: Array<{
      value: string;
      keys: string[];
      suggestedKey: string;
      confidence: number;
    }> = [];

    for (const duplicate of duplicates) {
      // Choose the shortest, most semantic key as the suggested consolidation target
      const sortedKeys = duplicate.keys.sort((a, b) => {
        // Prefer shorter keys
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        // Prefer keys without numbers
        const aHasNumbers = /\d/.test(a);
        const bHasNumbers = /\d/.test(b);
        if (aHasNumbers !== bHasNumbers) {
          return aHasNumbers ? 1 : -1;
        }
        // Alphabetical order as tiebreaker
        return a.localeCompare(b);
      });

      suggestions.push({
        value: duplicate.value,
        keys: duplicate.keys,
        suggestedKey: sortedKeys[0],
        confidence: 0.8 // High confidence for consolidation suggestions
      });
    }

    return suggestions;
  }

  /**
   * Generate keys for multiple text matches (batch processing)
   */
  async generateKeys(matches: Array<{ text: string; filePath: string; context?: string }>): Promise<GeneratedKey[]> {
    if (!matches) {
      throw new Error('Matches parameter is undefined. Please ensure scan results contain a valid matches array.');
    }
    
    if (!Array.isArray(matches)) {
      throw new Error(`Expected matches to be an array, but got: ${typeof matches}`);
    }
    
    logger.info(`Generating keys for ${matches.length} text matches`);
    
    const results: GeneratedKey[] = [];
    
    for (const match of matches) {
      try {
        const result = await this.processTextForKey(match.text, 'en', match.context);
        results.push({
          key: result.finalKey,
          originalText: match.text,
          confidence: result.generatedKey.confidence,
          suggestions: result.generatedKey.suggestions
        });
      } catch (error) {
        logger.warn(`Failed to generate key for text "${match.text}": ${error}`);
        // Generate a fallback key
        const fallbackKey = this.keyGenerator.generateKey(match.text, match.context);
        results.push(fallbackKey);
      }
    }
    
    logger.info(`Successfully generated ${results.length} keys`);
    return results;
  }

  /**
   * Reset all internal state (useful for testing or new sessions)
   */
  reset(): void {
    this.keyGenerator.resetUsedKeys();
    this.duplicateDetector.clear();
    this.keyValidator.clearUsedKeys();
    
    logger.info('KeyManager state reset');
  }

  /**
   * Get comprehensive statistics about the key management system
   */
  getStatistics(): {
    totalProcessedKeys: number;
    duplicateStats: Record<string, { totalKeys: number; duplicateValues: number; duplicateKeys: number }>;
    validationStats: {
      totalValidated: number;
      validKeys: number;
      invalidKeys: number;
    };
  } {
    const usedKeys = this.keyValidator.getUsedKeys();
    const duplicateStats = this.getDuplicateStatistics();
    
    // Calculate validation stats (simplified - in real implementation, you'd track this)
    const validationStats = {
      totalValidated: usedKeys.length,
      validKeys: usedKeys.length, // Assume all used keys are valid after processing
      invalidKeys: 0
    };

    return {
      totalProcessedKeys: usedKeys.length,
      duplicateStats,
      validationStats
    };
  }
}