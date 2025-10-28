import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { logger } from '../utils';
import { ScanResult, GeneratedKey, TransformationResult, ValidationResult } from '../types';

/**
 * Input/Output utilities for CLI operations
 */
export class IOUtils {
  /**
   * Save scan results to file
   */
  static async saveScanResults(
    results: ScanResult, 
    filePath: string, 
    format: 'json' | 'table' | 'csv' = 'json'
  ): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let content: string;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(results, null, 2);
          break;
        case 'csv':
          content = this.scanResultsToCSV(results);
          break;
        case 'table':
          content = this.scanResultsToTable(results);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Scan results saved to: ${filePath}`);
      
    } catch (error) {
      throw new Error(`Failed to save scan results: ${error}`);
    }
  }

  /**
   * Load scan results from file
   */
  static async loadScanResults(filePath: string): Promise<ScanResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const results = JSON.parse(content) as ScanResult;
      
      // Validate structure
      if (!results.matches || !Array.isArray(results.matches)) {
        throw new Error('Invalid scan results format');
      }
      
      logger.info(`Loaded scan results from: ${filePath}`);
      return results;
      
    } catch (error) {
      throw new Error(`Failed to load scan results: ${error}`);
    }
  }

  /**
   * Save generated keys to file
   */
  static async saveGeneratedKeys(
    keys: GeneratedKey[], 
    filePath: string, 
    format: 'json' | 'yaml' = 'json'
  ): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let content: string;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(keys, null, 2);
          break;
        case 'yaml':
          content = this.keysToYAML(keys);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Generated keys saved to: ${filePath}`);
      
    } catch (error) {
      throw new Error(`Failed to save generated keys: ${error}`);
    }
  }

  /**
   * Load generated keys from file
   */
  static async loadGeneratedKeys(filePath: string): Promise<GeneratedKey[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const keys = JSON.parse(content) as GeneratedKey[];
      
      // Validate structure
      if (!Array.isArray(keys)) {
        throw new Error('Invalid generated keys format');
      }
      
      logger.info(`Loaded generated keys from: ${filePath}`);
      return keys;
      
    } catch (error) {
      throw new Error(`Failed to load generated keys: ${error}`);
    }
  }

  /**
   * Save transformation results to file
   */
  static async saveTransformationResults(
    results: TransformationResult[], 
    filePath: string
  ): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      const content = JSON.stringify(results, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
      
      logger.info(`Transformation results saved to: ${filePath}`);
      
    } catch (error) {
      throw new Error(`Failed to save transformation results: ${error}`);
    }
  }

  /**
   * Save validation results to file
   */
  static async saveValidationResults(
    results: ValidationResult, 
    filePath: string,
    format: 'json' | 'html' = 'json'
  ): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let content: string;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(results, null, 2);
          break;
        case 'html':
          content = this.validationResultsToHTML(results);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Validation results saved to: ${filePath}`);
      
    } catch (error) {
      throw new Error(`Failed to save validation results: ${error}`);
    }
  }

  /**
   * Create a timestamped backup directory
   */
  static async createBackupDirectory(baseDir: string = '.i18n-backups'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(baseDir, `backup-${timestamp}`);
    
    await fs.mkdir(backupDir, { recursive: true });
    logger.info(`Created backup directory: ${backupDir}`);
    
    return backupDir;
  }

  /**
   * Check if file exists and is readable
   */
  static async validateInputFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Input file not accessible: ${filePath}`);
    }
  }

  /**
   * Check if output directory is writable
   */
  static async validateOutputPath(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.access(dir, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`Output directory not writable: ${dir}`);
    }
  }

  /**
   * Get file size in human-readable format
   */
  static async getFileSize(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      const bytes = stats.size;
      
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Convert scan results to CSV format
   */
  private static scanResultsToCSV(results: ScanResult): string {
    const headers = ['File Path', 'Line', 'Column', 'Context', 'Text'];
    const rows = [headers.join(',')];
    
    results.matches.forEach(match => {
      const row = [
        `"${match.filePath}"`,
        match.lineNumber.toString(),
        match.columnNumber.toString(),
        match.context,
        `"${match.text.replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }

  /**
   * Convert scan results to table format
   */
  private static scanResultsToTable(results: ScanResult): string {
    const lines = [
      'i18n Integration - Scan Results',
      '='.repeat(50),
      `Total Files Processed: ${results.processedFiles}`,
      `Text Matches Found: ${results.matches.length}`,
      `Errors: ${results.errors.length}`,
      '',
      'Matches:',
      '-'.repeat(50)
    ];
    
    results.matches.forEach((match, index) => {
      lines.push(`${index + 1}. ${match.text}`);
      lines.push(`   File: ${match.filePath}:${match.lineNumber}:${match.columnNumber}`);
      lines.push(`   Context: ${match.context}`);
      lines.push('');
    });
    
    if (results.errors.length > 0) {
      lines.push('Errors:');
      lines.push('-'.repeat(50));
      results.errors.forEach((error, index) => {
        lines.push(`${index + 1}. ${error}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Convert keys to YAML format (simple implementation)
   */
  private static keysToYAML(keys: GeneratedKey[]): string {
    const lines = ['# Generated Translation Keys', ''];
    
    keys.forEach(key => {
      lines.push(`${key.key}:`);
      lines.push(`  original: "${key.originalText.replace(/"/g, '\\"')}"`);
      lines.push(`  confidence: ${key.confidence}`);
      if (key.suggestions && key.suggestions.length > 0) {
        lines.push(`  suggestions:`);
        key.suggestions.forEach(suggestion => {
          lines.push(`    - "${suggestion}"`);
        });
      }
      lines.push('');
    });
    
    return lines.join('\n');
  }

  /**
   * Convert validation results to HTML format
   */
  private static validationResultsToHTML(results: ValidationResult): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>i18n Integration - Validation Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .section { margin: 20px 0; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>i18n Integration - Validation Results</h1>
        <p>Generated on: ${new Date().toISOString()}</p>
    </div>
    
    <div class="section">
        <h2>Overall Status</h2>
        <p class="${results.isValid ? 'success' : 'error'}">
            ${results.isValid ? '✅ Validation Passed' : '❌ Validation Failed'}
        </p>
    </div>
    
    ${results.errors.length > 0 ? `
    <div class="section">
        <h2 class="error">Errors (${results.errors.length})</h2>
        <ul>
            ${results.errors.map(error => `<li class="error">${error}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${results.warnings.length > 0 ? `
    <div class="section">
        <h2 class="warning">Warnings (${results.warnings.length})</h2>
        <ul>
            ${results.warnings.map(warning => `<li class="warning">${warning}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${results.suggestions.length > 0 ? `
    <div class="section">
        <h2>Suggestions</h2>
        <ul>
            ${results.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>`;
    
    return html;
  }
}

/**
 * Interactive prompt utilities
 */
export class PromptUtils {
  /**
   * Simple yes/no confirmation
   */
  static async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    // In a real implementation, you would use a library like 'inquirer' or 'prompts'
    // For now, we'll return the default value
    console.log(chalk.yellow(`${message} ${defaultValue ? '(Y/n)' : '(y/N)'}`));
    return defaultValue;
  }

  /**
   * Select from multiple options
   */
  static async select(message: string, options: string[]): Promise<string> {
    console.log(chalk.blue(message));
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option}`);
    });
    
    // For now, return the first option
    return options[0];
  }

  /**
   * Text input with validation
   */
  static async input(message: string, validator?: (input: string) => boolean | string): Promise<string> {
    console.log(chalk.blue(message));
    
    // For now, return empty string
    return '';
  }

  /**
   * Multi-select from options
   */
  static async multiSelect(message: string, options: string[]): Promise<string[]> {
    console.log(chalk.blue(message));
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option}`);
    });
    
    // For now, return all options
    return options;
  }
}