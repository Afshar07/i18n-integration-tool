import * as fs from 'fs/promises';
import * as path from 'path';
import { TranslationData, TranslationEntry, I18nIntegrationConfig } from '../types';
import { logger } from '../utils';

/**
 * JSON file manager for handling translation file operations
 */
export class JSONManager {
  constructor(private config: I18nIntegrationConfig) {}

  /**
   * Read and parse existing translation file
   */
  async readTranslationFile(locale: string): Promise<Record<string, string>> {
    const filePath = this.getTranslationFilePath(locale);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      logger.info(`Successfully read translation file: ${filePath}`);
      return parsed;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info(`Translation file not found, creating new: ${filePath}`);
        return {};
      }
      
      logger.error(`Error reading translation file ${filePath}:`, error);
      throw new Error(`Failed to read translation file: ${error.message}`);
    }
  }

  /**
   * Write translation data to JSON file with proper formatting
   */
  async writeTranslationFile(locale: string, translations: Record<string, string>): Promise<void> {
    const filePath = this.getTranslationFilePath(locale);
    
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(filePath));
      
      // Sort keys for consistent output
      const sortedTranslations = this.sortTranslations(translations);
      
      // Write with proper JSON formatting (2 spaces indentation)
      const content = JSON.stringify(sortedTranslations, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
      
      logger.info(`Successfully wrote translation file: ${filePath}`);
    } catch (error: any) {
      logger.error(`Error writing translation file ${filePath}:`, error);
      throw new Error(`Failed to write translation file: ${error.message}`);
    }
  }

  /**
   * Update translation file with new keys and values
   */
  async updateTranslationFile(locale: string, newEntries: Record<string, string>): Promise<void> {
    try {
      // Read existing translations
      const existingTranslations = await this.readTranslationFile(locale);
      
      // Merge with new entries
      const updatedTranslations = {
        ...existingTranslations,
        ...newEntries
      };
      
      // Write back to file
      await this.writeTranslationFile(locale, updatedTranslations);
      
      logger.info(`Updated translation file for locale ${locale} with ${Object.keys(newEntries).length} new entries`);
    } catch (error: any) {
      logger.error(`Error updating translation file for locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * Add a single translation entry
   */
  async addTranslationEntry(entry: TranslationEntry): Promise<void> {
    try {
      const newEntries = { [entry.key]: entry.value };
      await this.updateTranslationFile(entry.locale, newEntries);
      
      logger.info(`Added translation entry: ${entry.key} = "${entry.value}" (${entry.locale})`);
    } catch (error: any) {
      logger.error(`Error adding translation entry:`, error);
      throw error;
    }
  }

  /**
   * Get all translation keys for a locale
   */
  async getTranslationKeys(locale: string): Promise<string[]> {
    try {
      const translations = await this.readTranslationFile(locale);
      return Object.keys(translations);
    } catch (error: any) {
      logger.error(`Error getting translation keys for locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * Get all translation values for a locale
   */
  async getTranslationValues(locale: string): Promise<string[]> {
    try {
      const translations = await this.readTranslationFile(locale);
      return Object.values(translations);
    } catch (error: any) {
      logger.error(`Error getting translation values for locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists in translation file
   */
  async keyExists(locale: string, key: string): Promise<boolean> {
    try {
      const translations = await this.readTranslationFile(locale);
      return key in translations;
    } catch (error: any) {
      logger.error(`Error checking key existence:`, error);
      return false;
    }
  }

  /**
   * Validate JSON structure and syntax
   */
  async validateTranslationFile(locale: string): Promise<{ isValid: boolean; errors: string[] }> {
    const filePath = this.getTranslationFilePath(locale);
    const errors: string[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Try to parse JSON
      const parsed = JSON.parse(content);
      
      // Validate structure
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push('Translation file must contain a JSON object');
      }
      
      // Check for non-string values
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
          errors.push(`Translation key "${key}" has non-string value: ${typeof value}`);
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { isValid: true, errors: [] }; // File doesn't exist yet, that's ok
      }
      
      errors.push(`JSON parsing error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Get the file path for a translation file
   */
  private getTranslationFilePath(locale: string): string {
    const fileName = `${locale}.json`;
    return path.join(this.config.translationFiles.directory, fileName);
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Sort translations alphabetically by key
   */
  private sortTranslations(translations: Record<string, string>): Record<string, string> {
    const sortedKeys = Object.keys(translations).sort();
    const sorted: Record<string, string> = {};
    
    for (const key of sortedKeys) {
      sorted[key] = translations[key];
    }
    
    return sorted;
  }
}