/**
 * File scanner orchestrator that coordinates AST and template parsers
 * Implements recursive directory scanning with exclude patterns
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { ASTParser, StringLiteralMatch } from './ast-parser';
import { VueParser, VueTextMatch, VueParseResult } from './vue-parser';
import { TextMatch, I18nIntegrationConfig } from '../types';
import { Logger } from '../utils/logger';

export interface ScanOptions {
  /** Directories to scan */
  directories: string[];
  
  /** File patterns to include (glob patterns) */
  includePatterns: string[];
  
  /** File patterns to exclude (glob patterns) */
  excludePatterns: string[];
  
  /** Maximum file size to process (in bytes) */
  maxFileSize: number;
  
  /** Whether to follow symbolic links */
  followSymlinks: boolean;
  
  /** Whether to scan recursively */
  recursive: boolean;
  
  /** Maximum depth for recursive scanning */
  maxDepth: number;
}

export interface ScanResult {
  /** All text matches found */
  matches: TextMatch[];
  
  /** Total files found */
  totalFiles: number;
  
  /** Files successfully processed */
  processedFiles: number;
  
  /** Errors encountered during scanning */
  errors: string[];
  
  /** Vue-specific matches */
  vueMatches: VueTextMatch[];
  
  /** JavaScript/TypeScript matches */
  jsMatches: StringLiteralMatch[];
  
  /** Scan statistics */
  stats: ScanStats;
  
  /** Warnings */
  warnings: string[];
}

export interface ScanStats {
  /** Total files found */
  totalFiles: number;
  
  /** Files successfully processed */
  processedFiles: number;
  
  /** Files skipped */
  skippedFiles: number;
  
  /** Files with errors */
  errorFiles: number;
  
  /** Total matches found */
  totalMatches: number;
  
  /** Vue files processed */
  vueFiles: number;
  
  /** JS/TS files processed */
  jsFiles: number;
  
  /** Processing time in milliseconds */
  processingTime: number;
  
  /** File type breakdown */
  fileTypes: Record<string, number>;
}

export interface ScanError {
  filePath: string;
  error: string;
  type: 'parse' | 'read' | 'access' | 'size';
}

/**
 * Default scan options
 */
export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  directories: ['./'],
  includePatterns: ['**/*.{vue,js,jsx,ts,tsx}'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.nuxt/**',
    '**/.output/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.d.ts'
  ],
  maxFileSize: 1024 * 1024, // 1MB
  followSymlinks: false,
  recursive: true,
  maxDepth: 10
};

/**
 * File scanner orchestrator
 */
export class FileScanner {
  private astParser: ASTParser;
  private vueParser: VueParser;
  private logger: Logger;
  private options: ScanOptions;

  constructor(configOrOptions: Partial<ScanOptions> | I18nIntegrationConfig, logger?: Logger) {
    // Convert I18nIntegrationConfig to ScanOptions if needed
    let scanOptions: Partial<ScanOptions>;
    
    if ('sourceDirectories' in configOrOptions) {
      // It's an I18nIntegrationConfig
      const config = configOrOptions as I18nIntegrationConfig;
      scanOptions = {
        directories: config.sourceDirectories,
        excludePatterns: config.excludePatterns,
        includePatterns: ['**/*.{vue,js,jsx,ts,tsx}'], // Default patterns
        maxFileSize: 1024 * 1024, // 1MB
        followSymlinks: false,
        recursive: true,
        maxDepth: 10
      };
    } else {
      // It's already ScanOptions
      scanOptions = configOrOptions as Partial<ScanOptions>;
    }
    
    this.options = { ...DEFAULT_SCAN_OPTIONS, ...scanOptions };
    this.astParser = new ASTParser();
    this.vueParser = new VueParser();
    this.logger = logger || new Logger();
  }

  /**
   * Scan directories for Persian/Arabic text
   */
  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    this.logger.info('Starting file scan...');

    const result: ScanResult = {
      matches: [],
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      vueMatches: [],
      jsMatches: [],
      stats: {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errorFiles: 0,
        totalMatches: 0,
        vueFiles: 0,
        jsFiles: 0,
        processingTime: 0,
        fileTypes: {}
      },
      warnings: []
    };

    try {
      // Find all files to process
      const files = await this.findFiles();
      result.stats.totalFiles = files.length;

      this.logger.info(`Found ${files.length} files to process`);

      // Process files in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await this.processBatch(batch, result);
        
        this.logger.info(`Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
      }

      // Calculate final statistics
      result.stats!.processingTime = Date.now() - startTime;
      result.stats!.totalMatches = result.matches.length;
      result.totalFiles = result.stats!.totalFiles;
      result.processedFiles = result.stats!.processedFiles;

      this.logger.info(`Scan completed in ${result.stats!.processingTime}ms`);
      this.logger.info(`Found ${result.stats!.totalMatches} Persian/Arabic text matches`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scan failed: ${errorMessage}`);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Find all files matching the scan criteria
   */
  private async findFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const directory of this.options.directories) {
      try {
        // Resolve directory path
        const resolvedDir = path.resolve(directory);
        
        // Check if directory exists
        const stat = await fs.stat(resolvedDir);
        if (!stat.isDirectory()) {
          this.logger.warn(`Skipping ${directory}: not a directory`);
          continue;
        }

        // Build glob patterns
        const patterns = this.options.includePatterns.map(pattern => 
          path.join(resolvedDir, pattern).replace(/\\/g, '/')
        );

        // Find files using glob
        for (const pattern of patterns) {
          const files = await glob(pattern, {
            ignore: this.options.excludePatterns,
            follow: this.options.followSymlinks,
            maxDepth: this.options.recursive ? this.options.maxDepth : 1,
            absolute: true
          });

          allFiles.push(...files);
        }

      } catch (error) {
        this.logger.warn(`Error scanning directory ${directory}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Remove duplicates and sort
    return [...new Set(allFiles)].sort();
  }

  /**
   * Process a batch of files
   */
  private async processBatch(files: string[], result: ScanResult): Promise<void> {
    const promises = files.map(filePath => this.processFile(filePath, result));
    await Promise.allSettled(promises);
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, result: ScanResult): Promise<void> {
    try {
      // Check file size
      const stat = await fs.stat(filePath);
      if (stat.size > this.options.maxFileSize) {
        result.warnings.push(`Skipping ${filePath}: file too large (${stat.size} bytes)`);
        result.stats.skippedFiles++;
        return;
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Update file type statistics
      const ext = path.extname(filePath).toLowerCase();
      result.stats.fileTypes[ext] = (result.stats.fileTypes[ext] || 0) + 1;

      // Process based on file type
      if (VueParser.isVueFile(filePath)) {
        await this.processVueFile(filePath, content, result);
        result.stats.vueFiles++;
      } else if (ASTParser.canParseFile(filePath)) {
        await this.processJSFile(filePath, content, result);
        result.stats.jsFiles++;
      } else {
        result.warnings.push(`Unsupported file type: ${filePath}`);
        result.stats.skippedFiles++;
        return;
      }

      result.stats.processedFiles++;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      result.errors.push(`${filePath}: ${errorMessage}`);
      
      result.stats.errorFiles++;
      this.logger.warn(`Error processing ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Process Vue file
   */
  private async processVueFile(filePath: string, content: string, result: ScanResult): Promise<void> {
    const vueResult = await this.vueParser.parseVueFile(content, filePath);
    
    // Add errors to result
    if (vueResult.errors.length > 0) {
      for (const error of vueResult.errors) {
        result.errors.push(`${filePath}: ${error}`);
      }
    }

    // Collect all Vue matches
    const allVueMatches = [
      ...vueResult.template,
      ...vueResult.script,
      ...vueResult.style
    ];

    result.vueMatches.push(...allVueMatches);
    result.matches.push(...allVueMatches);
  }

  /**
   * Process JavaScript/TypeScript file
   */
  private async processJSFile(filePath: string, content: string, result: ScanResult): Promise<void> {
    const parserOptions = ASTParser.getParserOptions(filePath);
    const parser = new ASTParser(parserOptions);
    
    const jsMatches = await parser.parseContent(content, filePath);
    
    result.jsMatches.push(...jsMatches);
    result.matches.push(...jsMatches);
  }

  /**
   * Categorize error types
   */
  private categorizeError(error: unknown): ScanError['type'] {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('permission') || message.includes('access')) {
        return 'access';
      }
      
      if (message.includes('size') || message.includes('too large')) {
        return 'size';
      }
      
      if (message.includes('parse') || message.includes('syntax')) {
        return 'parse';
      }
    }
    
    return 'read';
  }

  /**
   * Generate scan report
   */
  generateReport(result: ScanResult): string {
    const { stats, errors, warnings } = result;
    
    const report = [
      '=== File Scan Report ===',
      '',
      `Processing Time: ${stats.processingTime}ms`,
      `Total Files Found: ${stats.totalFiles}`,
      `Files Processed: ${stats.processedFiles}`,
      `Files Skipped: ${stats.skippedFiles}`,
      `Files with Errors: ${stats.errorFiles}`,
      '',
      `Total Persian/Arabic Matches: ${stats.totalMatches}`,
      `Vue Files: ${stats.vueFiles}`,
      `JS/TS Files: ${stats.jsFiles}`,
      '',
      'File Types:',
      ...Object.entries(stats.fileTypes).map(([ext, count]) => `  ${ext}: ${count}`),
      ''
    ];

    if (warnings.length > 0) {
      report.push('Warnings:');
      report.push(...warnings.map(w => `  - ${w}`));
      report.push('');
    }

    if (errors.length > 0) {
      report.push('Errors:');
      report.push(...errors.map(e => `  - ${e}`));
      report.push('');
    }

    return report.join('\n');
  }

  /**
   * Export matches to JSON
   */
  exportMatches(result: ScanResult, outputPath: string): Promise<void> {
    const exportData = {
      timestamp: new Date().toISOString(),
      stats: result.stats,
      matches: result.matches.map(match => ({
        text: match.text,
        filePath: match.filePath,
        lineNumber: match.lineNumber,
        columnNumber: match.columnNumber,
        context: match.context,
        ...(match as any) // Include additional properties
      })),
      errors: result.errors,
      warnings: result.warnings
    };

    return fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  /**
   * Filter matches by criteria
   */
  static filterMatches(matches: TextMatch[], criteria: {
    minLength?: number;
    maxLength?: number;
    context?: string;
    filePath?: string;
  }): TextMatch[] {
    return matches.filter(match => {
      if (criteria.minLength && match.text.length < criteria.minLength) return false;
      if (criteria.maxLength && match.text.length > criteria.maxLength) return false;
      if (criteria.context && match.context !== criteria.context) return false;
      if (criteria.filePath && !match.filePath.includes(criteria.filePath)) return false;
      return true;
    });
  }

  /**
   * Group matches by file
   */
  static groupMatchesByFile(matches: TextMatch[]): Record<string, TextMatch[]> {
    const grouped: Record<string, TextMatch[]> = {};
    
    for (const match of matches) {
      if (!grouped[match.filePath]) {
        grouped[match.filePath] = [];
      }
      grouped[match.filePath].push(match);
    }
    
    return grouped;
  }

  /**
   * Get unique texts from matches
   */
  static getUniqueTexts(matches: TextMatch[]): string[] {
    const uniqueTexts = new Set<string>();
    
    for (const match of matches) {
      uniqueTexts.add(match.text);
    }
    
    return Array.from(uniqueTexts).sort();
  }
}

export default FileScanner;