import { ValidationResult, I18nIntegrationConfig, TextMatch } from '../types';
import { logger, FileOperations } from '../utils';
import { TextPatternMatcher, CONTEXT_PATTERNS } from '../scanner/text-patterns';
import { NuxtIntegrationValidator, NuxtValidationOptions, NuxtValidationResult } from './nuxt-integration-validator';
import * as babel from '@babel/parser';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Validation options for different validation checks
 */
export interface ValidationOptions {
  checkReplacedStrings?: boolean;
  checkTranslationKeys?: boolean;
  checkSyntax?: boolean;
  checkImports?: boolean;
  sourceDirectories?: string[];
  excludePatterns?: string[];
}

/**
 * Detailed validation report for a single file
 */
export interface FileValidationResult {
  filePath: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  unreplacedStrings: TextMatch[];
  missingKeys: string[];
  syntaxErrors: string[];
  importIssues: string[];
}

/**
 * Comprehensive validation report
 */
export interface ComprehensiveValidationResult extends ValidationResult {
  fileResults: FileValidationResult[];
  summary: {
    totalFiles: number;
    validFiles: number;
    filesWithErrors: number;
    totalUnreplacedStrings: number;
    totalMissingKeys: number;
    totalSyntaxErrors: number;
  };
}

/**
 * Comprehensive validation system for i18n integration
 */
export class ValidationSystem {
  private nuxtValidator: NuxtIntegrationValidator;

  constructor(private config: I18nIntegrationConfig, private projectRoot: string = process.cwd()) {
    this.nuxtValidator = new NuxtIntegrationValidator(config, projectRoot);
  }

  /**
   * Perform comprehensive validation of i18n integration
   */
  async validateIntegration(options: ValidationOptions = {}): Promise<ComprehensiveValidationResult> {
    logger.info('🔍 Starting comprehensive i18n integration validation...');

    const {
      checkReplacedStrings = true,
      checkTranslationKeys = true,
      checkSyntax = true,
      checkImports = true,
      sourceDirectories = this.config.sourceDirectories,
      excludePatterns = this.config.excludePatterns
    } = options;

    const fileResults: FileValidationResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Get all source files to validate
      const sourceFiles = await this.getSourceFiles(sourceDirectories, excludePatterns);
      logger.info(`Validating ${sourceFiles.length} source files...`);

      // Validate each file
      for (const filePath of sourceFiles) {
        const fileResult = await this.validateFile(filePath, {
          checkReplacedStrings,
          checkTranslationKeys,
          checkSyntax,
          checkImports
        });
        fileResults.push(fileResult);

        // Aggregate errors and warnings
        if (!fileResult.isValid) {
          errors.push(...fileResult.errors.map(err => `${filePath}: ${err}`));
        }
        warnings.push(...fileResult.warnings.map(warn => `${filePath}: ${warn}`));
      }

      // Generate summary
      const summary = this.generateSummary(fileResults);

      // Generate suggestions based on findings
      if (summary.totalUnreplacedStrings > 0) {
        suggestions.push(`Found ${summary.totalUnreplacedStrings} unreplaced Persian/Arabic strings. Run the transformation process again.`);
      }
      
      if (summary.totalMissingKeys > 0) {
        suggestions.push(`Found ${summary.totalMissingKeys} missing translation keys. Update translation files or regenerate keys.`);
      }
      
      if (summary.totalSyntaxErrors > 0) {
        suggestions.push(`Found ${summary.totalSyntaxErrors} syntax errors. Review transformed code and fix syntax issues.`);
      }

      const isValid = errors.length === 0;
      
      logger.info(`Validation completed: ${isValid ? '✅ PASSED' : '❌ FAILED'} (${errors.length} errors, ${warnings.length} warnings)`);

      return {
        isValid,
        errors,
        warnings,
        suggestions,
        fileResults,
        summary
      };

    } catch (error) {
      logger.error('Validation failed with error:', error as Error);
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings,
        suggestions,
        fileResults,
        summary: {
          totalFiles: 0,
          validFiles: 0,
          filesWithErrors: 0,
          totalUnreplacedStrings: 0,
          totalMissingKeys: 0,
          totalSyntaxErrors: 0
        }
      };
    }
  }

  /**
   * Validate a single file
   */
  async validateFile(filePath: string, options: {
    checkReplacedStrings: boolean;
    checkTranslationKeys: boolean;
    checkSyntax: boolean;
    checkImports: boolean;
  }): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      filePath,
      isValid: true,
      errors: [],
      warnings: [],
      unreplacedStrings: [],
      missingKeys: [],
      syntaxErrors: [],
      importIssues: []
    };

    try {
      const content = await FileOperations.readFile(filePath);

      // Check for unreplaced Persian/Arabic strings
      if (options.checkReplacedStrings) {
        result.unreplacedStrings = await this.findUnreplacedStrings(filePath, content);
        if (result.unreplacedStrings.length > 0) {
          result.errors.push(`Found ${result.unreplacedStrings.length} unreplaced Persian/Arabic strings`);
          result.isValid = false;
        }
      }

      // Check for missing translation keys
      if (options.checkTranslationKeys) {
        result.missingKeys = await this.findMissingTranslationKeys(content);
        if (result.missingKeys.length > 0) {
          result.errors.push(`Found ${result.missingKeys.length} missing translation keys`);
          result.isValid = false;
        }
      }

      // Check syntax validity
      if (options.checkSyntax) {
        result.syntaxErrors = await this.validateSyntax(filePath, content);
        if (result.syntaxErrors.length > 0) {
          result.errors.push(`Found ${result.syntaxErrors.length} syntax errors`);
          result.isValid = false;
        }
      }

      // Check import issues
      if (options.checkImports) {
        result.importIssues = await this.validateImports(filePath, content);
        if (result.importIssues.length > 0) {
          result.warnings.push(`Found ${result.importIssues.length} import issues`);
        }
      }

    } catch (error) {
      result.errors.push(`Failed to validate file: ${error}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Find unreplaced Persian/Arabic strings in file content
   */
  private async findUnreplacedStrings(filePath: string, content: string): Promise<TextMatch[]> {
    const matches: TextMatch[] = [];

    try {
      // Determine file type and context
      const isVueFile = filePath.endsWith('.vue');
      const isJsTs = filePath.endsWith('.js') || filePath.endsWith('.ts') || 
                    filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

      if (isVueFile) {
        // Check Vue template section
        const templateContent = this.extractVueTemplate(content);
        if (templateContent) {
          const templateMatches = TextPatternMatcher.extractMatches(templateContent, CONTEXT_PATTERNS.VUE_TEMPLATE);
          matches.push(...templateMatches.map((match: any) => ({
            text: match.text,
            filePath,
            lineNumber: this.getLineNumber(content, match.index),
            columnNumber: this.getColumnNumber(content, match.index),
            context: 'template' as const
          })));
        }

        // Check Vue script section
        const scriptContent = this.extractVueScript(content);
        if (scriptContent) {
          const scriptMatches = TextPatternMatcher.extractMatches(scriptContent, CONTEXT_PATTERNS.JS_TS);
          matches.push(...scriptMatches.map((match: any) => ({
            text: match.text,
            filePath,
            lineNumber: this.getLineNumber(content, match.index),
            columnNumber: this.getColumnNumber(content, match.index),
            context: 'script' as const
          })));
        }

      } else if (isJsTs) {
        // Check JavaScript/TypeScript content
        const scriptMatches = TextPatternMatcher.extractMatches(content, CONTEXT_PATTERNS.JS_TS);
        matches.push(...scriptMatches.map((match: any) => ({
          text: match.text,
          filePath,
          lineNumber: this.getLineNumber(content, match.index),
          columnNumber: this.getColumnNumber(content, match.index),
          context: 'script' as const
        })));
      }

      // Filter out strings that are already wrapped in $t() calls
      const unreplacedMatches = matches.filter(match => {
        return !this.isStringAlreadyWrapped(content, match);
      });

      return unreplacedMatches;

    } catch (error) {
      logger.warn(`Error finding unreplaced strings in ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Check if a string is already wrapped in $t() call
   */
  private isStringAlreadyWrapped(content: string, match: TextMatch): boolean {
    const lines = content.split('\n');
    const line = lines[match.lineNumber - 1];
    
    if (!line) return false;

    // Look for $t() wrapper around the text
    const beforeText = line.substring(0, match.columnNumber);
    const afterText = line.substring(match.columnNumber + match.text.length);

    // Check for various $t() patterns
    const tCallPatterns = [
      /\$t\s*\(\s*['"`]$/,  // $t('
      /\$t\s*\(\s*$/,       // $t(
      /t\s*\(\s*['"`]$/,    // t('
      /t\s*\(\s*$/          // t(
    ];

    const hasOpeningPattern = tCallPatterns.some(pattern => pattern.test(beforeText));
    const hasClosingPattern = /^['"`]\s*\)/.test(afterText) || /^\s*\)/.test(afterText);

    return hasOpeningPattern && hasClosingPattern;
  }

  /**
   * Find missing translation keys referenced in code
   */
  private async findMissingTranslationKeys(content: string): Promise<string[]> {
    const missingKeys: string[] = [];

    try {
      // Extract all $t() calls from content
      const tCallRegex = /\$t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      const matches = content.matchAll(tCallRegex);

      // Load translation files
      const sourceTranslations = await this.loadTranslationFile(this.config.locales.source);
      const targetTranslations = await this.loadTranslationFile(this.config.locales.target);

      for (const match of matches) {
        const key = match[1];
        
        // Check if key exists in both translation files
        if (!sourceTranslations.hasOwnProperty(key)) {
          missingKeys.push(`${key} (missing in ${this.config.locales.source})`);
        }
        
        if (!targetTranslations.hasOwnProperty(key)) {
          missingKeys.push(`${key} (missing in ${this.config.locales.target})`);
        }
      }

    } catch (error) {
      logger.warn('Error finding missing translation keys:', error);
    }

    return [...new Set(missingKeys)]; // Remove duplicates
  }

  /**
   * Validate syntax of transformed code
   */
  private async validateSyntax(filePath: string, content: string): Promise<string[]> {
    const syntaxErrors: string[] = [];

    try {
      const isVueFile = filePath.endsWith('.vue');
      const isJsTs = filePath.endsWith('.js') || filePath.endsWith('.ts') || 
                    filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

      if (isVueFile) {
        // Extract and validate script section from Vue file
        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
          const scriptContent = scriptMatch[1];
          await this.validateJavaScriptSyntax(scriptContent, filePath);
        }

        // Validate template section (basic check)
        const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
        if (templateMatch) {
          const templateContent = templateMatch[1];
          const templateErrors = this.validateTemplateSyntax(templateContent);
          syntaxErrors.push(...templateErrors);
        }

      } else if (isJsTs) {
        // Validate JavaScript/TypeScript syntax
        await this.validateJavaScriptSyntax(content, filePath);
      }

    } catch (error) {
      syntaxErrors.push(`Syntax validation failed: ${error}`);
    }

    return syntaxErrors;
  }

  /**
   * Validate JavaScript/TypeScript syntax using Babel parser
   */
  private async validateJavaScriptSyntax(content: string, filePath: string): Promise<void> {
    try {
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
      const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

      const plugins: any[] = [];
      if (isTypeScript) plugins.push('typescript');
      if (isJSX) plugins.push('jsx');

      babel.parse(content, {
        sourceType: 'module',
        plugins,
        errorRecovery: false
      });

    } catch (error: any) {
      throw new Error(`JavaScript syntax error: ${error.message}`);
    }
  }

  /**
   * Basic validation of Vue template syntax
   */
  private validateTemplateSyntax(templateContent: string): string[] {
    const errors: string[] = [];

    // Check for unclosed tags
    const openTags = templateContent.match(/<[^/][^>]*>/g) || [];
    const closeTags = templateContent.match(/<\/[^>]*>/g) || [];
    
    if (openTags.length !== closeTags.length) {
      errors.push('Potential unclosed HTML tags in template');
    }

    // Check for malformed $t() calls
    const malformedTCalls = templateContent.match(/\$t\s*\([^)]*$/gm);
    if (malformedTCalls) {
      errors.push(`Found ${malformedTCalls.length} potentially malformed $t() calls`);
    }

    return errors;
  }

  /**
   * Validate import statements and i18n setup
   */
  private async validateImports(filePath: string, content: string): Promise<string[]> {
    const issues: string[] = [];

    try {
      const isVueFile = filePath.endsWith('.vue');
      
      // Check if file uses $t() but doesn't have proper imports
      const usesTFunction = /\$t\s*\(/.test(content);
      
      if (usesTFunction) {
        let scriptContent = content;
        
        if (isVueFile) {
          const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
          scriptContent = scriptMatch ? scriptMatch[1] : '';
        }

        // Check for useI18n import
        const hasUseI18nImport = /import.*useI18n.*from.*@nuxtjs\/i18n/.test(scriptContent) ||
                                /import.*useI18n.*from.*vue-i18n/.test(scriptContent);
        
        // Check for useI18n usage
        const hasUseI18nUsage = /const\s*{\s*[^}]*t\s*[^}]*}\s*=\s*useI18n\s*\(\s*\)/.test(scriptContent);

        if (!hasUseI18nImport) {
          issues.push('File uses $t() but missing useI18n import');
        }

        if (!hasUseI18nUsage) {
          issues.push('File uses $t() but missing useI18n() setup');
        }
      }

    } catch (error) {
      issues.push(`Import validation failed: ${error}`);
    }

    return issues;
  }

  /**
   * Load translation file content
   */
  private async loadTranslationFile(locale: string): Promise<Record<string, string>> {
    try {
      const translationPath = path.join(
        this.config.translationFiles.directory,
        `${locale}.json`
      );
      
      const content = await fs.readFile(translationPath, 'utf-8');
      return JSON.parse(content);
      
    } catch (error) {
      logger.warn(`Failed to load translation file for locale ${locale}:`, error);
      return {};
    }
  }

  /**
   * Get all source files to validate
   */
  private async getSourceFiles(sourceDirectories: string[], excludePatterns: string[]): Promise<string[]> {
    const files: string[] = [];

    for (const directory of sourceDirectories) {
      try {
        const dirFiles = await this.getFilesRecursively(directory, excludePatterns);
        files.push(...dirFiles);
      } catch (error) {
        logger.warn(`Failed to scan directory ${directory}:`, error);
      }
    }

    return files;
  }

  /**
   * Recursively get files from directory
   */
  private async getFilesRecursively(directory: string, excludePatterns: string[]): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        // Check if path should be excluded
        const shouldExclude = excludePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(fullPath);
        });

        if (shouldExclude) continue;

        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursively(fullPath, excludePatterns);
          files.push(...subFiles);
        } else if (this.isSourceFile(entry.name)) {
          files.push(fullPath);
        }
      }

    } catch (error) {
      logger.warn(`Error reading directory ${directory}:`, error);
    }

    return files;
  }

  /**
   * Check if file is a source file that should be validated
   */
  private isSourceFile(fileName: string): boolean {
    const sourceExtensions = ['.vue', '.js', '.ts', '.jsx', '.tsx'];
    return sourceExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * Generate validation summary
   */
  private generateSummary(fileResults: FileValidationResult[]): ComprehensiveValidationResult['summary'] {
    return {
      totalFiles: fileResults.length,
      validFiles: fileResults.filter(r => r.isValid).length,
      filesWithErrors: fileResults.filter(r => !r.isValid).length,
      totalUnreplacedStrings: fileResults.reduce((sum, r) => sum + r.unreplacedStrings.length, 0),
      totalMissingKeys: fileResults.reduce((sum, r) => sum + r.missingKeys.length, 0),
      totalSyntaxErrors: fileResults.reduce((sum, r) => sum + r.syntaxErrors.length, 0)
    };
  }

  /**
   * Extract template section from Vue file
   */
  private extractVueTemplate(content: string): string | null {
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    return templateMatch ? templateMatch[1] : null;
  }

  /**
   * Extract script section from Vue file
   */
  private extractVueScript(content: string): string | null {
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    return scriptMatch ? scriptMatch[1] : null;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return beforeIndex.split('\n').length;
  }

  /**
   * Get column number from character index
   */
  private getColumnNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    const lastNewlineIndex = beforeIndex.lastIndexOf('\n');
    return lastNewlineIndex === -1 ? index : index - lastNewlineIndex - 1;
  }

  /**
   * Validate Nuxt.js integration with i18n system
   */
  async validateNuxtIntegration(options: NuxtValidationOptions = {}): Promise<NuxtValidationResult> {
    logger.info('🚀 Starting Nuxt.js integration validation...');
    return await this.nuxtValidator.validateNuxtIntegration(options);
  }
}