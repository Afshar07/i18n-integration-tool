import { ValidationResult } from '../types';
import { logger } from '../utils';

/**
 * Key validation rules and constraints
 */
export interface KeyValidationRules {
  maxLength: number;
  minLength: number;
  allowedCharacters: RegExp;
  forbiddenPatterns: RegExp[];
  reservedWords: string[];
  requirePrefix?: string;
  requireSuffix?: string;
  caseSensitive: boolean;
}

/**
 * Default validation rules for translation keys
 */
export const DEFAULT_KEY_RULES: KeyValidationRules = {
  maxLength: 100,
  minLength: 2,
  allowedCharacters: /^[a-z0-9_]+$/,
  forbiddenPatterns: [
    /^_+$/, // Only underscores
    /^[0-9]+$/, // Only numbers
    /__+/, // Multiple consecutive underscores
    /^_|_$/, // Leading or trailing underscores
  ],
  reservedWords: [
    'undefined', 'null', 'true', 'false', 'function', 'var', 'let', 'const',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'this',
    'super', 'class', 'extends', 'import', 'export', 'from', 'as', 'default'
  ],
  caseSensitive: false
};

/**
 * Key validator and normalizer for translation keys
 */
export class KeyValidator {
  private rules: KeyValidationRules;
  private usedKeys = new Set<string>();

  constructor(rules: Partial<KeyValidationRules> = {}) {
    this.rules = { ...DEFAULT_KEY_RULES, ...rules };
  }

  /**
   * Validate a translation key against all rules
   */
  validateKey(key: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!key || typeof key !== 'string') {
      errors.push('Key must be a non-empty string');
      return { isValid: false, errors, warnings, suggestions };
    }

    // Length validation
    if (key.length < this.rules.minLength) {
      errors.push(`Key must be at least ${this.rules.minLength} characters long`);
    }

    if (key.length > this.rules.maxLength) {
      errors.push(`Key must not exceed ${this.rules.maxLength} characters`);
      suggestions.push(this.truncateKey(key));
    }

    // Character validation
    if (!this.rules.allowedCharacters.test(key)) {
      errors.push('Key contains invalid characters. Only lowercase letters, numbers, and underscores are allowed');
      suggestions.push(this.sanitizeKey(key));
    }

    // Forbidden patterns
    for (const pattern of this.rules.forbiddenPatterns) {
      if (pattern.test(key)) {
        errors.push(`Key matches forbidden pattern: ${pattern.source}`);
        suggestions.push(this.fixForbiddenPattern(key, pattern));
      }
    }

    // Reserved words
    const keyToCheck = this.rules.caseSensitive ? key : key.toLowerCase();
    if (this.rules.reservedWords.includes(keyToCheck)) {
      errors.push(`Key "${key}" is a reserved word`);
      suggestions.push(`${key}_key`);
    }

    // Prefix/suffix requirements
    if (this.rules.requirePrefix && !key.startsWith(this.rules.requirePrefix)) {
      warnings.push(`Key should start with prefix "${this.rules.requirePrefix}"`);
      suggestions.push(`${this.rules.requirePrefix}_${key}`);
    }

    if (this.rules.requireSuffix && !key.endsWith(this.rules.requireSuffix)) {
      warnings.push(`Key should end with suffix "${this.rules.requireSuffix}"`);
      suggestions.push(`${key}_${this.rules.requireSuffix}`);
    }

    // Uniqueness check
    if (this.usedKeys.has(key)) {
      errors.push(`Key "${key}" is already in use`);
      suggestions.push(this.generateUniqueKey(key));
    }

    // Additional semantic warnings
    this.addSemanticWarnings(key, warnings, suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: [...new Set(suggestions)] // Remove duplicates
    };
  }

  /**
   * Normalize a key to conform to validation rules
   */
  normalizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      return 'invalid_key';
    }

    let normalized = key;

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    // Remove or replace invalid characters
    normalized = this.sanitizeKey(normalized);

    // Fix forbidden patterns
    for (const pattern of this.rules.forbiddenPatterns) {
      if (pattern.test(normalized)) {
        normalized = this.fixForbiddenPattern(normalized, pattern);
      }
    }

    // Apply length constraints
    if (normalized.length > this.rules.maxLength) {
      normalized = this.truncateKey(normalized);
    }

    // Ensure minimum length
    if (normalized.length < this.rules.minLength) {
      normalized = this.padKey(normalized);
    }

    // Handle reserved words
    const keyToCheck = this.rules.caseSensitive ? normalized : normalized.toLowerCase();
    if (this.rules.reservedWords.includes(keyToCheck)) {
      normalized = `${normalized}_key`;
    }

    // Add required prefix/suffix
    if (this.rules.requirePrefix && !normalized.startsWith(this.rules.requirePrefix)) {
      normalized = `${this.rules.requirePrefix}_${normalized}`;
    }

    if (this.rules.requireSuffix && !normalized.endsWith(this.rules.requireSuffix)) {
      normalized = `${normalized}_${this.rules.requireSuffix}`;
    }

    // Ensure uniqueness
    normalized = this.ensureUniqueness(normalized);

    return normalized;
  }

  /**
   * Sanitize key by removing/replacing invalid characters
   */
  private sanitizeKey(key: string): string {
    return key
      .replace(/[^a-z0-9_]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  }

  /**
   * Fix forbidden patterns in key
   */
  private fixForbiddenPattern(key: string, pattern: RegExp): string {
    switch (pattern.source) {
      case '^_+$': // Only underscores
        return 'unnamed_key';
      case '^[0-9]+$': // Only numbers
        return `key_${key}`;
      case '__+': // Multiple consecutive underscores
        return key.replace(/__+/g, '_');
      case '^_|_$': // Leading or trailing underscores
        return key.replace(/^_+|_+$/g, '');
      default:
        return key.replace(pattern, '_');
    }
  }

  /**
   * Truncate key while maintaining readability
   */
  private truncateKey(key: string): string {
    if (key.length <= this.rules.maxLength) {
      return key;
    }

    const parts = key.split('_');

    // If single word, truncate directly
    if (parts.length === 1) {
      return key.substring(0, this.rules.maxLength);
    }

    // Try to keep meaningful parts
    let result = '';
    for (const part of parts) {
      if (result.length + part.length + 1 <= this.rules.maxLength) {
        result += (result ? '_' : '') + part;
      } else {
        // Add abbreviated version if space allows
        const remaining = this.rules.maxLength - result.length - 1;
        if (remaining > 0) {
          result += (result ? '_' : '') + part.substring(0, remaining);
        }
        break;
      }
    }

    return result || key.substring(0, this.rules.maxLength);
  }

  /**
   * Pad key to meet minimum length requirement
   */
  private padKey(key: string): string {
    if (key.length >= this.rules.minLength) {
      return key;
    }

    // Add meaningful suffix
    const suffixes = ['key', 'text', 'label', 'msg'];
    for (const suffix of suffixes) {
      const padded = `${key}_${suffix}`;
      if (padded.length >= this.rules.minLength) {
        return padded;
      }
    }

    // Fallback: pad with numbers
    let counter = 1;
    while (key.length < this.rules.minLength) {
      key += `_${counter}`;
      counter++;
    }

    return key;
  }

  /**
   * Ensure key uniqueness by adding suffixes
   */
  private ensureUniqueness(key: string): string {
    let uniqueKey = key;
    let counter = 1;

    while (this.usedKeys.has(uniqueKey)) {
      uniqueKey = `${key}_${counter}`;
      counter++;
    }

    return uniqueKey;
  }

  /**
   * Generate a unique key based on existing key
   */
  private generateUniqueKey(baseKey: string): string {
    let counter = 1;
    let uniqueKey = `${baseKey}_${counter}`;

    while (this.usedKeys.has(uniqueKey)) {
      counter++;
      uniqueKey = `${baseKey}_${counter}`;
    }

    return uniqueKey;
  }

  /**
   * Add semantic warnings and suggestions
   */
  private addSemanticWarnings(key: string, warnings: string[], suggestions: string[]): void {
    // Check for very short keys
    if (key.length < 4) {
      warnings.push('Key is very short and may not be descriptive enough');
    }

    // Check for generic keys
    const genericPatterns = ['text', 'label', 'msg', 'str', 'val'];
    if (genericPatterns.some(pattern => key.includes(pattern))) {
      warnings.push('Key appears to be generic. Consider using more descriptive names');
    }

    // Check for abbreviations
    if (key.includes('_') && key.split('_').some(part => part.length <= 2)) {
      warnings.push('Key contains very short parts that may be unclear');
    }

    // Suggest improvements for common patterns
    if (key.startsWith('btn_')) {
      suggestions.push(key.replace('btn_', 'button_'));
    }
    if (key.startsWith('txt_')) {
      suggestions.push(key.replace('txt_', 'text_'));
    }
    if (key.startsWith('lbl_')) {
      suggestions.push(key.replace('lbl_', 'label_'));
    }
  }

  /**
   * Add existing keys to prevent duplicates
   */
  addExistingKeys(keys: string[]): void {
    keys.forEach(key => this.usedKeys.add(key));
    logger.debug(`Added ${keys.length} existing keys to validator`);
  }

  /**
   * Mark a key as used
   */
  markKeyAsUsed(key: string): void {
    this.usedKeys.add(key);
  }

  /**
   * Check if a key is already used
   */
  isKeyUsed(key: string): boolean {
    return this.usedKeys.has(key);
  }

  /**
   * Get all used keys
   */
  getUsedKeys(): string[] {
    return Array.from(this.usedKeys);
  }

  /**
   * Clear all used keys
   */
  clearUsedKeys(): void {
    this.usedKeys.clear();
    logger.debug('Cleared used keys from validator');
  }

  /**
   * Update validation rules
   */
  updateRules(newRules: Partial<KeyValidationRules>): void {
    this.rules = { ...this.rules, ...newRules };
    logger.debug('Updated validation rules');
  }

  /**
   * Get current validation rules
   */
  getRules(): KeyValidationRules {
    return { ...this.rules };
  }
}