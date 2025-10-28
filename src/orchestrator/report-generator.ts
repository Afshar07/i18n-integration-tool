import * as path from 'path';
import { FileOperations } from '../utils/file-operations';
import { logger } from '../utils';
import { 
  WorkflowResult, 
  ScanResult, 
  GeneratedKey, 
  TransformationResult, 
  ValidationResult,
  ProcessingError,
  TextMatch,
  I18nIntegrationConfig
} from '../types';
import { ComprehensiveValidationResult } from '../validator/validation-system';

/**
 * Report generation options
 */
export interface ReportOptions {
  format: 'json' | 'html' | 'markdown' | 'csv';
  outputPath?: string;
  includeDetails: boolean;
  includeStatistics: boolean;
  includeRecommendations: boolean;
}

/**
 * Report data structure
 */
export interface Report {
  metadata: {
    generatedAt: string;
    version: string;
    executionTime: number;
    success: boolean;
    configUsed: Partial<I18nIntegrationConfig>;
  };
  summary: {
    totalFiles: number;
    processedFiles: number;
    foundStrings: number;
    generatedKeys: number;
    transformedFiles: number;
    errors: number;
    warnings: number;
  };
  phases: {
    scan?: ScanPhaseReport;
    keyGeneration?: KeyGenerationReport;
    transformation?: TransformationReport;
    validation?: ValidationReport;
  };
  coverage: TranslationCoverage;
  missingTranslations: MissingTranslationReport;
  orphanedKeys: OrphanedKeyReport;
  fileModifications: FileModificationReport;
  errors: ProcessingError[];
  warnings: string[];
  recommendations: string[];
  statistics: ReportStatistics;
}

/**
 * Phase-specific report interfaces
 */
interface ScanPhaseReport {
  totalFiles: number;
  processedFiles: number;
  matchesFound: number;
  fileTypes: Record<string, number>;
  directories: Record<string, number>;
  errors: string[];
}

interface KeyGenerationReport {
  totalKeys: number;
  averageConfidence: number;
  strategyUsed: string;
  duplicatesFound: number;
  keyLengthDistribution: Record<string, number>;
}

interface TransformationReport {
  filesTransformed: number;
  importsAdded: number;
  replacementsMade: number;
  backupsCreated: number;
  errors: string[];
}

interface ValidationReport {
  isValid: boolean;
  checksPerformed: string[];
  issuesFound: number;
  missingKeys: string[];
  orphanedKeys: string[];
  syntaxErrors: string[];
}

interface ReportStatistics {
  processingRate: number; // files per second
  averageFileSize: number;
  largestFile: string;
  mostComplexFile: string;
  textDensity: number; // matches per file
  keyEfficiency: number; // successful key generations per match
  translationCompleteness: number; // percentage of strings with translations
  codeTransformationRate: number; // percentage of strings successfully transformed
}

/**
 * Translation coverage analysis
 */
interface TranslationCoverage {
  totalStringsFound: number;
  stringsWithTranslations: number;
  stringsTransformed: number;
  coveragePercentage: number;
  coverageByFile: Record<string, FileCoverage>;
  coverageByDirectory: Record<string, DirectoryCoverage>;
}

interface FileCoverage {
  filePath: string;
  totalStrings: number;
  transformedStrings: number;
  missingTranslations: number;
  coveragePercentage: number;
  unreplacedStrings: TextMatch[];
}

interface DirectoryCoverage {
  directory: string;
  totalFiles: number;
  filesWithStrings: number;
  totalStrings: number;
  transformedStrings: number;
  coveragePercentage: number;
}

/**
 * Missing translation analysis
 */
interface MissingTranslationReport {
  totalMissing: number;
  missingByLocale: Record<string, string[]>;
  missingByFile: Record<string, string[]>;
  criticalMissing: string[]; // Keys used in code but missing in all locales
  suggestions: string[];
}

/**
 * Orphaned key analysis
 */
interface OrphanedKeyReport {
  totalOrphaned: number;
  orphanedByLocale: Record<string, string[]>;
  potentialOrphans: string[]; // Keys that might be unused
  cleanupSuggestions: string[];
}

/**
 * File modification tracking
 */
interface FileModificationReport {
  totalModified: number;
  modificationsByType: Record<string, number>;
  backupsCreated: string[];
  importChanges: ImportChangeReport[];
  codeTransformations: CodeTransformationReport[];
  largestChanges: FileChangeDetail[];
}

interface ImportChangeReport {
  filePath: string;
  importsAdded: string[];
  importType: 'useI18n' | 'other';
}

interface CodeTransformationReport {
  filePath: string;
  totalReplacements: number;
  replacementDetails: {
    originalText: string;
    newKey: string;
    lineNumber: number;
    context: string;
  }[];
}

interface FileChangeDetail {
  filePath: string;
  changeCount: number;
  changeTypes: string[];
  sizeChange: number; // bytes
}

/**
 * Comprehensive report generator for workflow results
 */
export class ReportGenerator {
  /**
   * Generate comprehensive report from workflow result
   */
  static async generateReport(
    workflowResult: WorkflowResult, 
    options: ReportOptions,
    config?: I18nIntegrationConfig
  ): Promise<string> {
    const report = this.buildReport(workflowResult, config);
    
    switch (options.format) {
      case 'json':
        return this.generateJSONReport(report, options);
      case 'html':
        return this.generateHTMLReport(report, options);
      case 'markdown':
        return this.generateMarkdownReport(report, options);
      case 'csv':
        return this.generateCSVReport(report, options);
      default:
        throw new Error(`Unsupported report format: ${options.format}`);
    }
  }

  /**
   * Generate comprehensive validation report
   */
  static async generateValidationReport(
    validationResult: ComprehensiveValidationResult,
    options: ReportOptions,
    config?: I18nIntegrationConfig
  ): Promise<string> {
    // Convert validation result to workflow result format for reporting
    const workflowResult: WorkflowResult = {
      success: validationResult.isValid,
      phase: 'validating',
      validationResult: validationResult,
      errors: validationResult.errors.map(error => ({ message: error } as ProcessingError)),
      warnings: validationResult.warnings,
      executionTime: 0,
      processedFiles: validationResult.summary.totalFiles
    };

    return this.generateReport(workflowResult, options, config);
  }

  /**
   * Save report to file
   */
  static async saveReport(
    workflowResult: WorkflowResult, 
    options: ReportOptions,
    config?: I18nIntegrationConfig
  ): Promise<string> {
    const reportContent = await this.generateReport(workflowResult, options, config);
    
    const outputPath = options.outputPath || this.getDefaultOutputPath(options.format);
    await FileOperations.writeFile(outputPath, reportContent);
    
    logger.info(`Report saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Save comprehensive validation report to file
   */
  static async saveValidationReport(
    validationResult: ComprehensiveValidationResult,
    options: ReportOptions,
    config?: I18nIntegrationConfig
  ): Promise<string> {
    const reportContent = await this.generateValidationReport(validationResult, options, config);
    
    const outputPath = options.outputPath || this.getDefaultOutputPath(`validation-${options.format}`);
    await FileOperations.writeFile(outputPath, reportContent);
    
    logger.info(`Comprehensive validation report saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate summary report (brief overview)
   */
  static generateSummaryReport(workflowResult: WorkflowResult): string {
    const lines = [
      '🚀 i18n Integration Summary',
      '=' .repeat(30),
      '',
      `Status: ${workflowResult.success ? '✅ Success' : '❌ Failed'}`,
      `Phase: ${workflowResult.phase}`,
      `Execution Time: ${this.formatDuration(workflowResult.executionTime)}`,
      `Files Processed: ${workflowResult.processedFiles}`,
      ''
    ];

    if (workflowResult.scanResult) {
      lines.push(`📊 Scan Results:`);
      lines.push(`  - Text matches found: ${workflowResult.scanResult.matches.length}`);
      lines.push(`  - Files scanned: ${workflowResult.scanResult.processedFiles}`);
      lines.push('');
    }

    if (workflowResult.generatedKeys) {
      lines.push(`🔑 Key Generation:`);
      lines.push(`  - Keys generated: ${workflowResult.generatedKeys.length}`);
      lines.push('');
    }

    if (workflowResult.transformationResults) {
      lines.push(`🔄 Transformation:`);
      lines.push(`  - Files transformed: ${workflowResult.transformationResults.length}`);
      lines.push('');
    }

    if (workflowResult.validationResult) {
      lines.push(`✅ Validation:`);
      lines.push(`  - Status: ${workflowResult.validationResult.isValid ? 'Passed' : 'Failed'}`);
      if (!workflowResult.validationResult.isValid) {
        lines.push(`  - Issues: ${workflowResult.validationResult.errors.length}`);
      }
      lines.push('');
    }

    if (workflowResult.errors.length > 0) {
      lines.push(`❌ Errors (${workflowResult.errors.length}):`);
      workflowResult.errors.slice(0, 3).forEach((error: ProcessingError) => {
        lines.push(`  - ${error.message}`);
      });
      if (workflowResult.errors.length > 3) {
        lines.push(`  ... and ${workflowResult.errors.length - 3} more`);
      }
      lines.push('');
    }

    if (workflowResult.warnings.length > 0) {
      lines.push(`⚠️ Warnings (${workflowResult.warnings.length}):`);
      workflowResult.warnings.slice(0, 3).forEach((warning: string) => {
        lines.push(`  - ${warning}`);
      });
      if (workflowResult.warnings.length > 3) {
        lines.push(`  ... and ${workflowResult.warnings.length - 3} more`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build comprehensive report data structure
   */
  private static buildReport(workflowResult: WorkflowResult, config?: I18nIntegrationConfig): Report {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        executionTime: workflowResult.executionTime,
        success: workflowResult.success,
        configUsed: config ? {
          sourceDirectories: config.sourceDirectories,
          locales: config.locales,
          keyGeneration: config.keyGeneration
        } : {}
      },
      summary: this.buildSummary(workflowResult),
      phases: this.buildPhaseReports(workflowResult),
      coverage: this.buildTranslationCoverage(workflowResult),
      missingTranslations: this.buildMissingTranslationReport(workflowResult),
      orphanedKeys: this.buildOrphanedKeyReport(workflowResult),
      fileModifications: this.buildFileModificationReport(workflowResult),
      errors: workflowResult.errors,
      warnings: workflowResult.warnings,
      recommendations: this.generateRecommendations(workflowResult),
      statistics: this.calculateStatistics(workflowResult)
    };
  }

  /**
   * Build summary section
   */
  private static buildSummary(workflowResult: WorkflowResult) {
    return {
      totalFiles: workflowResult.scanResult?.totalFiles || 0,
      processedFiles: workflowResult.processedFiles,
      foundStrings: workflowResult.scanResult?.matches.length || 0,
      generatedKeys: workflowResult.generatedKeys?.length || 0,
      transformedFiles: workflowResult.transformationResults?.length || 0,
      errors: workflowResult.errors.length,
      warnings: workflowResult.warnings.length
    };
  }

  /**
   * Build phase-specific reports
   */
  private static buildPhaseReports(workflowResult: WorkflowResult) {
    const phases: any = {};

    if (workflowResult.scanResult) {
      phases.scan = this.buildScanReport(workflowResult.scanResult);
    }

    if (workflowResult.generatedKeys) {
      phases.keyGeneration = this.buildKeyGenerationReport(workflowResult.generatedKeys);
    }

    if (workflowResult.transformationResults) {
      phases.transformation = this.buildTransformationReport(workflowResult.transformationResults);
    }

    if (workflowResult.validationResult) {
      phases.validation = this.buildValidationReport(workflowResult.validationResult);
    }

    return phases;
  }

  /**
   * Build scan phase report
   */
  private static buildScanReport(scanResult: ScanResult): ScanPhaseReport {
    const fileTypes: Record<string, number> = {};
    const directories: Record<string, number> = {};

    scanResult.matches.forEach(match => {
      const ext = path.extname(match.filePath);
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      const dir = path.dirname(match.filePath);
      directories[dir] = (directories[dir] || 0) + 1;
    });

    return {
      totalFiles: scanResult.totalFiles,
      processedFiles: scanResult.processedFiles,
      matchesFound: scanResult.matches.length,
      fileTypes,
      directories,
      errors: scanResult.errors
    };
  }

  /**
   * Build key generation report
   */
  private static buildKeyGenerationReport(keys: GeneratedKey[]): KeyGenerationReport {
    const totalConfidence = keys.reduce((sum, key) => sum + key.confidence, 0);
    const averageConfidence = keys.length > 0 ? totalConfidence / keys.length : 0;

    const keyLengthDistribution: Record<string, number> = {};
    keys.forEach(key => {
      const length = key.key.length;
      const range = `${Math.floor(length / 10) * 10}-${Math.floor(length / 10) * 10 + 9}`;
      keyLengthDistribution[range] = (keyLengthDistribution[range] || 0) + 1;
    });

    return {
      totalKeys: keys.length,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      strategyUsed: 'semantic', // This would come from config
      duplicatesFound: 0, // This would be calculated during generation
      keyLengthDistribution
    };
  }

  /**
   * Build transformation report
   */
  private static buildTransformationReport(results: TransformationResult[]): TransformationReport {
    const totalReplacements = results.reduce((sum, result) => sum + result.replacements.length, 0);
    const totalImports = results.reduce((sum, result) => sum + result.addedImports.length, 0);

    return {
      filesTransformed: results.length,
      importsAdded: totalImports,
      replacementsMade: totalReplacements,
      backupsCreated: results.length, // Assuming backup for each file
      errors: []
    };
  }

  /**
   * Build validation report
   */
  private static buildValidationReport(validationResult: ValidationResult): ValidationReport {
    return {
      isValid: validationResult.isValid,
      checksPerformed: ['key-existence', 'syntax-validation', 'duplicate-detection'],
      issuesFound: validationResult.errors.length,
      missingKeys: [], // Would be extracted from validation details
      orphanedKeys: [], // Would be extracted from validation details
      syntaxErrors: validationResult.errors.filter(error => error.includes('syntax'))
    };
  }

  /**
   * Generate recommendations based on results
   */
  private static generateRecommendations(workflowResult: WorkflowResult): string[] {
    const recommendations: string[] = [];

    if (workflowResult.errors.length > 0) {
      recommendations.push('Review and fix the reported errors before proceeding');
    }

    if (workflowResult.warnings.length > 0) {
      recommendations.push('Consider addressing the warnings to improve integration quality');
    }

    if (workflowResult.scanResult && workflowResult.scanResult.matches.length === 0) {
      recommendations.push('No Persian/Arabic text found - verify source directories and file patterns');
    }

    if (workflowResult.validationResult && !workflowResult.validationResult.isValid) {
      recommendations.push('Run validation again after fixing reported issues');
    }

    if (workflowResult.generatedKeys && workflowResult.generatedKeys.length > 100) {
      recommendations.push('Consider breaking down large translation files into smaller, more manageable files');
    }

    return recommendations;
  }

  /**
   * Calculate workflow statistics
   */
  private static calculateStatistics(workflowResult: WorkflowResult): ReportStatistics {
    const executionTimeSeconds = workflowResult.executionTime / 1000;
    const processingRate = executionTimeSeconds > 0 ? workflowResult.processedFiles / executionTimeSeconds : 0;

    const totalStrings = workflowResult.scanResult?.matches.length || 0;
    const transformedStrings = workflowResult.transformationResults?.reduce(
      (sum, result) => sum + result.replacements.length, 0
    ) || 0;

    return {
      processingRate: Math.round(processingRate * 100) / 100,
      averageFileSize: 0, // Would need file size data
      largestFile: '', // Would need file size data
      mostComplexFile: this.findMostComplexFile(workflowResult),
      textDensity: workflowResult.scanResult ? 
        workflowResult.scanResult.matches.length / Math.max(workflowResult.scanResult.processedFiles, 1) : 0,
      keyEfficiency: workflowResult.scanResult && workflowResult.generatedKeys ?
        workflowResult.generatedKeys.length / Math.max(workflowResult.scanResult.matches.length, 1) : 0,
      translationCompleteness: totalStrings > 0 ? (transformedStrings / totalStrings) * 100 : 0,
      codeTransformationRate: totalStrings > 0 ? (transformedStrings / totalStrings) * 100 : 0
    };
  }

  /**
   * Build translation coverage analysis
   */
  private static buildTranslationCoverage(workflowResult: WorkflowResult): TranslationCoverage {
    const totalStrings = workflowResult.scanResult?.matches.length || 0;
    const transformedStrings = workflowResult.transformationResults?.reduce(
      (sum, result) => sum + result.replacements.length, 0
    ) || 0;

    const coverageByFile: Record<string, FileCoverage> = {};
    const coverageByDirectory: Record<string, DirectoryCoverage> = {};

    // Build file-level coverage
    if (workflowResult.scanResult && workflowResult.transformationResults) {
      const fileStringCounts: Record<string, number> = {};
      const fileTransformCounts: Record<string, number> = {};

      // Count strings per file
      workflowResult.scanResult.matches.forEach(match => {
        fileStringCounts[match.filePath] = (fileStringCounts[match.filePath] || 0) + 1;
      });

      // Count transformations per file
      workflowResult.transformationResults.forEach(result => {
        fileTransformCounts[result.filePath] = result.replacements.length;
      });

      // Build coverage data
      Object.keys(fileStringCounts).forEach(filePath => {
        const totalFileStrings = fileStringCounts[filePath];
        const transformedFileStrings = fileTransformCounts[filePath] || 0;
        const coveragePercentage = totalFileStrings > 0 ? 
          (transformedFileStrings / totalFileStrings) * 100 : 0;

        coverageByFile[filePath] = {
          filePath,
          totalStrings: totalFileStrings,
          transformedStrings: transformedFileStrings,
          missingTranslations: totalFileStrings - transformedFileStrings,
          coveragePercentage: Math.round(coveragePercentage * 100) / 100,
          unreplacedStrings: workflowResult.scanResult!.matches.filter(
            match => match.filePath === filePath
          ).slice(0, transformedFileStrings) // Simplified - would need actual unreplaced strings
        };

        // Build directory-level coverage
        const directory = path.dirname(filePath);
        if (!coverageByDirectory[directory]) {
          coverageByDirectory[directory] = {
            directory,
            totalFiles: 0,
            filesWithStrings: 0,
            totalStrings: 0,
            transformedStrings: 0,
            coveragePercentage: 0
          };
        }

        const dirCoverage = coverageByDirectory[directory];
        dirCoverage.totalFiles++;
        dirCoverage.filesWithStrings++;
        dirCoverage.totalStrings += totalFileStrings;
        dirCoverage.transformedStrings += transformedFileStrings;
        dirCoverage.coveragePercentage = dirCoverage.totalStrings > 0 ?
          (dirCoverage.transformedStrings / dirCoverage.totalStrings) * 100 : 0;
      });
    }

    return {
      totalStringsFound: totalStrings,
      stringsWithTranslations: transformedStrings,
      stringsTransformed: transformedStrings,
      coveragePercentage: totalStrings > 0 ? (transformedStrings / totalStrings) * 100 : 0,
      coverageByFile,
      coverageByDirectory
    };
  }

  /**
   * Build missing translation report
   */
  private static buildMissingTranslationReport(workflowResult: WorkflowResult): MissingTranslationReport {
    const missingByLocale: Record<string, string[]> = {};
    const missingByFile: Record<string, string[]> = {};
    const criticalMissing: string[] = [];
    const suggestions: string[] = [];

    // Extract missing translations from validation results
    if (workflowResult.validationResult) {
      // This would be populated from comprehensive validation results
      // For now, provide structure with placeholder data
      missingByLocale['fa'] = [];
      missingByLocale['en'] = [];
    }

    // Generate suggestions based on missing translations
    const totalMissing = Object.values(missingByLocale).reduce((sum, keys) => sum + keys.length, 0);
    
    if (totalMissing > 0) {
      suggestions.push(`Found ${totalMissing} missing translations across all locales`);
      suggestions.push('Run the key generation process to create missing translation entries');
      suggestions.push('Review and provide translations for generated keys');
    }

    if (criticalMissing.length > 0) {
      suggestions.push(`${criticalMissing.length} keys are used in code but missing in all translation files`);
    }

    return {
      totalMissing,
      missingByLocale,
      missingByFile,
      criticalMissing,
      suggestions
    };
  }

  /**
   * Build orphaned key report
   */
  private static buildOrphanedKeyReport(workflowResult: WorkflowResult): OrphanedKeyReport {
    const orphanedByLocale: Record<string, string[]> = {};
    const potentialOrphans: string[] = [];
    const cleanupSuggestions: string[] = [];

    // This would be populated by analyzing translation files vs code usage
    // For now, provide structure with placeholder data
    orphanedByLocale['fa'] = [];
    orphanedByLocale['en'] = [];

    const totalOrphaned = Object.values(orphanedByLocale).reduce((sum, keys) => sum + keys.length, 0);

    if (totalOrphaned > 0) {
      cleanupSuggestions.push(`Found ${totalOrphaned} potentially orphaned translation keys`);
      cleanupSuggestions.push('Review orphaned keys before removing to ensure they are not used dynamically');
      cleanupSuggestions.push('Consider keeping keys that might be used in future features');
    }

    return {
      totalOrphaned,
      orphanedByLocale,
      potentialOrphans,
      cleanupSuggestions
    };
  }

  /**
   * Build file modification report
   */
  private static buildFileModificationReport(workflowResult: WorkflowResult): FileModificationReport {
    const modificationsByType: Record<string, number> = {
      'vue': 0,
      'js': 0,
      'ts': 0,
      'jsx': 0,
      'tsx': 0
    };

    const backupsCreated: string[] = [];
    const importChanges: ImportChangeReport[] = [];
    const codeTransformations: CodeTransformationReport[] = [];
    const largestChanges: FileChangeDetail[] = [];

    if (workflowResult.transformationResults) {
      workflowResult.transformationResults.forEach(result => {
        const ext = path.extname(result.filePath).substring(1);
        modificationsByType[ext] = (modificationsByType[ext] || 0) + 1;

        // Track backups (assuming backup was created for each transformed file)
        backupsCreated.push(`${result.filePath}.backup`);

        // Track import changes
        if (result.addedImports.length > 0) {
          importChanges.push({
            filePath: result.filePath,
            importsAdded: result.addedImports,
            importType: result.addedImports.some(imp => imp.includes('useI18n')) ? 'useI18n' : 'other'
          });
        }

        // Track code transformations
        codeTransformations.push({
          filePath: result.filePath,
          totalReplacements: result.replacements.length,
          replacementDetails: result.replacements.map(replacement => ({
            originalText: replacement.originalText,
            newKey: replacement.replacementKey,
            lineNumber: replacement.position.line,
            context: 'string-replacement'
          }))
        });

        // Track largest changes
        largestChanges.push({
          filePath: result.filePath,
          changeCount: result.replacements.length + result.addedImports.length,
          changeTypes: [
            ...(result.replacements.length > 0 ? ['text-replacement'] : []),
            ...(result.addedImports.length > 0 ? ['import-addition'] : [])
          ],
          sizeChange: 0 // Would need actual file size comparison
        });
      });

      // Sort largest changes by change count
      largestChanges.sort((a, b) => b.changeCount - a.changeCount);
    }

    return {
      totalModified: workflowResult.transformationResults?.length || 0,
      modificationsByType,
      backupsCreated,
      importChanges,
      codeTransformations,
      largestChanges: largestChanges.slice(0, 10) // Top 10 largest changes
    };
  }

  /**
   * Find the most complex file (file with most text matches)
   */
  private static findMostComplexFile(workflowResult: WorkflowResult): string {
    if (!workflowResult.scanResult) return '';

    const fileCounts: Record<string, number> = {};
    workflowResult.scanResult.matches.forEach(match => {
      fileCounts[match.filePath] = (fileCounts[match.filePath] || 0) + 1;
    });

    let mostComplexFile = '';
    let maxCount = 0;
    Object.entries(fileCounts).forEach(([filePath, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostComplexFile = filePath;
      }
    });

    return mostComplexFile;
  }

  /**
   * Generate JSON report
   */
  private static generateJSONReport(report: Report, options: ReportOptions): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  private static generateHTMLReport(report: Report, options: ReportOptions): string {
    const statusClass = report.metadata.success ? 'success' : 'error';
    const statusText = report.metadata.success ? '✅ Success' : '❌ Failed';
    const coverageClass = this.getCoverageClass(report.coverage.coveragePercentage);
    
    let html = `<!DOCTYPE html>
<html>
<head>
    <title>i18n Integration Comprehensive Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 30px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .section { margin: 30px 0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #f8f9fa; }
        .stat-card h3 { margin-top: 0; color: #495057; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .file-path { font-family: monospace; font-size: 0.9em; }
        .metric-highlight { font-size: 1.2em; font-weight: bold; }
        .coverage-good { color: #28a745; }
        .coverage-medium { color: #ffc107; }
        .coverage-poor { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌐 i18n Integration Comprehensive Report</h1>
        <p><strong>Generated:</strong> ${report.metadata.generatedAt}</p>
        <p><strong>Execution Time:</strong> ${this.formatDuration(report.metadata.executionTime)}</p>
        <p class="${statusClass} metric-highlight">Status: ${statusText}</p>
    </div>
    
    <div class="section">
        <h2>📊 Executive Summary</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>📁 File Processing</h3>
                <p><strong>Processed:</strong> ${report.summary.processedFiles}</p>
                <p><strong>Total Scanned:</strong> ${report.summary.totalFiles}</p>
                <p><strong>Modified:</strong> ${report.fileModifications.totalModified}</p>
            </div>
            <div class="stat-card">
                <h3>🔤 Text Analysis</h3>
                <p><strong>Strings Found:</strong> ${report.summary.foundStrings}</p>
                <p><strong>Keys Generated:</strong> ${report.summary.generatedKeys}</p>
                <p><strong>Transformed:</strong> ${report.coverage.stringsTransformed}</p>
            </div>
            <div class="stat-card">
                <h3>📈 Coverage</h3>
                <p><strong>Translation Coverage:</strong>
                   <span class="${coverageClass}">${report.coverage.coveragePercentage.toFixed(1)}%</span>
                </p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${report.coverage.coveragePercentage}%"></div>
                </div>
            </div>
            <div class="stat-card">
                <h3>⚠️ Issues</h3>
                <p><strong>Errors:</strong> <span class="error">${report.summary.errors}</span></p>
                <p><strong>Warnings:</strong> <span class="warning">${report.summary.warnings}</span></p>
                <p><strong>Missing Translations:</strong> <span class="warning">${report.missingTranslations.totalMissing}</span></p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📋 Translation Coverage Analysis</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Overall Coverage</h3>
                <p><strong>Total Strings:</strong> ${report.coverage.totalStringsFound}</p>
                <p><strong>With Translations:</strong> ${report.coverage.stringsWithTranslations}</p>
                <p><strong>Coverage Rate:</strong> ${report.coverage.coveragePercentage.toFixed(1)}%</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📈 Performance Statistics</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Processing Performance</h3>
                <p><strong>Processing Rate:</strong> ${report.statistics.processingRate} files/sec</p>
                <p><strong>Text Density:</strong> ${report.statistics.textDensity.toFixed(2)} strings/file</p>
                <p><strong>Key Efficiency:</strong> ${(report.statistics.keyEfficiency * 100).toFixed(1)}%</p>
            </div>
            <div class="stat-card">
                <h3>Transformation Metrics</h3>
                <p><strong>Translation Completeness:</strong> ${report.statistics.translationCompleteness.toFixed(1)}%</p>
                <p><strong>Code Transformation Rate:</strong> ${report.statistics.codeTransformationRate.toFixed(1)}%</p>`;

    if (report.statistics.mostComplexFile) {
      html += `\n                <p><strong>Most Complex File:</strong> <span class="file-path">${report.statistics.mostComplexFile}</span></p>`;
    }

    html += `
            </div>
        </div>
    </div>`;

    // Add errors section if there are errors
    if (report.errors.length > 0) {
      html += `
    <div class="section">
        <h2 class="error">❌ Errors (${report.errors.length})</h2>
        <ul>`;
      report.errors.forEach(error => {
        html += `\n            <li class="error">${error.message}</li>`;
      });
      html += `
        </ul>
    </div>`;
    }

    // Add warnings section if there are warnings
    if (report.warnings.length > 0) {
      html += `
    <div class="section">
        <h2 class="warning">⚠️ Warnings (${report.warnings.length})</h2>
        <ul>`;
      report.warnings.forEach(warning => {
        html += `\n            <li class="warning">${warning}</li>`;
      });
      html += `
        </ul>
    </div>`;
    }

    // Add recommendations section if there are recommendations
    if (report.recommendations.length > 0) {
      html += `
    <div class="section">
        <h2>💡 Recommendations</h2>
        <ul>`;
      report.recommendations.forEach(rec => {
        html += `\n            <li>${rec}</li>`;
      });
      html += `
        </ul>
    </div>`;
    }

    // Add configuration section
    html += `
    <div class="section">
        <h2>⚙️ Configuration Used</h2>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(report.metadata.configUsed, null, 2)}
        </pre>
    </div>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; text-align: center;">
        <p>Generated by i18n Integration Tool v${report.metadata.version}</p>
        <p>Report generated at ${report.metadata.generatedAt}</p>
    </footer>
</body>
</html>`;

    return html;
  }

  /**
  private static generateHTMLReport(report: Report, options: ReportOptions): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>i18n Integration Comprehensive Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 30px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .section { margin: 30px 0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #f8f9fa; }
        .stat-card h3 { margin-top: 0; color: #495057; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .file-path { font-family: monospace; font-size: 0.9em; }
        .collapsible { cursor: pointer; padding: 10px; background: #f8f9fa; border: 1px solid #ddd; margin: 5px 0; }
        .collapsible:hover { background: #e9ecef; }
        .collapsible-content { display: none; padding: 15px; border: 1px solid #ddd; border-top: none; }
        .metric-highlight { font-size: 1.2em; font-weight: bold; }
        .coverage-good { color: #28a745; }
        .coverage-medium { color: #ffc107; }
        .coverage-poor { color: #dc3545; }
    </style>
    <script>
        function toggleCollapsible(element) {
            const content = element.nextElementSibling;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>🌐 i18n Integration Comprehensive Report</h1>
        <p><strong>Generated:</strong> ${report.metadata.generatedAt}</p>
        <p><strong>Execution Time:</strong> ${this.formatDuration(report.metadata.executionTime)}</p>
        <p class="${report.metadata.success ? 'success' : 'error'} metric-highlight">
            Status: ${report.metadata.success ? '✅ Success' : '❌ F</p>
        </p>
    </div>
    
    <div class="section">
        <h2>📊 Executive Summary</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>📁 File Processing</h3>
                <p><strong>Processed:</strong> ${report.summary.processedFiles}</p>
                <p><strong>Total Scanned:</strong> ${report.summary.totalFiles}</p>
                <p><strong>Modified:</strong> ${report.fileModifications.totalModified}</p>
            </div>
            <div class="stat-card">
                <h3>🔤 Text Analysis</h3>
                <p><strong>Strings Found:</strong> ${report.summary.foundStrings}</p>
                <p><strong>Keys Generated:</strong> ${report.summary.generatedKeys}</p>
                <p><strong>Transformed:</strong> ${report.coverage.stringsTransformed}</p>
            </div>
            <div class="stat-card">
                <h3>📈 Coverage</h3>
                <p><strong>Translation Coverage:</strong> 
                   <span class="${this.getCoverageClass(report.coverage.coveragePercentage)}">
                     ${report.coverage.coveragePercentage.toFixed(1)}%
                   </span>
                </p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${report.coverage.coveragePercentage}%"></div>
                </div>
            </div>
            <div class="stat-card">
                <h3>⚠️ Issues</h3>
                <p><strong>Errors:</strong> <span class="error">${report.summary.errors}</span></p>
                <p><strong>Warnings:</strong> <span class="warning">${report.summary.warnings}</span></p>
                <p><strong>Missing Translations:</strong> <span class="warning">${report.missingTranslations.totalMissing}</span></p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📋 Translation Coverage Analysis</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Overall Coverage</h3>
                <p><strong>Total Strings:</strong> ${report.coverage.totalStringsFound}</p>
                <p><strong>With Translations:</strong> ${report.coverage.stringsWithTranslations}</p>
                <p><strong>Coverage Rate:</strong> ${report.coverage.coveragePercentage.toFixed(1)}%</p>
            </div>
        </div>
        
        <div class="collapsible" onclick="toggleCollapsible(this)">
            <strong>📁 Coverage by File (Click to expand)</strong>
        </div>
        <div class="collapsible-content">
            <table>
                <tr>
                    <th>File Path</th>
                    <th>Total Strings</th>
                    <th>Transformed</th>
                    <th>Missing</th>
                    <th>Coverage %</th>
                </tr>
                ${Object.values(report.coverage.coverageByFile).map(file => `
                <tr>
                    <td class="file-path">${file.filePath}</td>
                    <td>${file.totalStrings}</td>
                    <td class="success">${file.transformedStrings}</td>
                    <td class="error">${file.missingTranslations}</td>
                    <td class="${this.getCoverageClass(file.coveragePercentage)}">${file.coveragePercentage.toFixed(1)}%</td>
                </tr>
                `).join('')}
            </table>
        </div>

        <div class="collapsible" onclick="toggleCollapsible(this)">
            <strong>📂 Coverage by Directory (Click to expand)</strong>
        </div>
        <div class="collapsible-content">
            <table>
                <tr>
                    <th>Directory</th>
                    <th>Files with Strings</th>
                    <th>Total Strings</th>
                    <th>Transformed</th>
                    <th>Coverage %</th>
                </tr>
                ${Object.values(report.coverage.coverageByDirectory).map(dir => `
                <tr>
                    <td class="file-path">${dir.directory}</td>
                    <td>${dir.filesWithStrings}</td>
                    <td>${dir.totalStrings}</td>
                    <td class="success">${dir.transformedStrings}</td>
                    <td class="${this.getCoverageClass(dir.coveragePercentage)}">${dir.coveragePercentage.toFixed(1)}%</td>
                </tr>
                `).join('')}
            </table>
        </div>
    </div>

    <div class="section">
        <h2>🔧 File Modifications Report</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Modification Summary</h3>
                <p><strong>Total Modified:</strong> ${report.fileModifications.totalModified}</p>
                <p><strong>Backups Created:</strong> ${report.fileModifications.backupsCreated.length}</p>
                <p><strong>Import Changes:</strong> ${report.fileModifications.importChanges.length}</p>
            </div>
            <div class="stat-card">
                <h3>By File Type</h3>
                ${Object.entries(report.fileModifications.modificationsByType).map(([type, count]) => 
                  count > 0 ? `<p><strong>.${type}:</strong> ${count}</p>` : ''
                ).join('')}
            </div>
        </div>

        <div class="collapsible" onclick="toggleCollapsible(this)">
            <strong>🔄 Code Transformations (Click to expand)</strong>
        </div>
        <div class="collapsible-content">
            <table>
                <tr>
                    <th>File Path</th>
                    <th>Total Replacements</th>
                    <th>Sample Transformations</th>
                </tr>
                ${report.fileModifications.codeTransformations.slice(0, 10).map(transform => `
                <tr>
                    <td class="file-path">${transform.filePath}</td>
                    <td>${transform.totalReplacements}</td>
                    <td>
                        ${transform.replacementDetails.slice(0, 3).map(detail => 
                          `<div style="font-size: 0.8em; margin: 2px 0;">
                             Line ${detail.lineNumber}: "${detail.originalText}" → $t('${detail.newKey}')
                           </div>`
                        ).join('')}
                        ${transform.replacementDetails.length > 3 ? `<div style="font-size: 0.8em; color: #666;">... and ${transform.replacementDetails.length - 3} more</div>` : ''}
                    </td>
                </tr>
                `).join('')}
            </table>
        </div>
    </div>

    ${report.missingTranslations.totalMissing > 0 ? `
    <div class="section">
        <h2 class="warning">⚠️ Missing Translations</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Missing Translation Summary</h3>
                <p><strong>Total Missing:</strong> ${report.missingTranslations.totalMissing}</p>
                <p><strong>Critical Missing:</strong> ${report.missingTranslations.criticalMissing.length}</p>
            </div>
        </div>
        
        ${report.missingTranslations.suggestions.length > 0 ? `
        <div class="collapsible" onclick="toggleCollapsible(this)">
            <strong>💡 Missing Translation Suggestions (Click to expand)</strong>
        </div>
        <div class="collapsible-content">
            <ul>
                ${report.missingTranslations.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>
    ` : ''}

    ${report.orphanedKeys.totalOrphaned > 0 ? `
    <div class="section">
        <h2 class="info">🗑️ Orphaned Keys</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Orphaned Key Summary</h3>
                <p><strong>Total Orphaned:</strong> ${report.orphanedKeys.totalOrphaned}</p>
                <p><strong>Potential Orphans:</strong> ${report.orphanedKeys.potentialOrphans.length}</p>
            </div>
        </div>
        
        ${report.orphanedKeys.cleanupSuggestions.length > 0 ? `
        <div class="collapsible" onclick="toggleCollapsible(this)">
            <strong>🧹 Cleanup Suggestions (Click to expand)</strong>
        </div>
        <div class="collapsible-content">
            <ul>
                ${report.orphanedKeys.cleanupSuggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>
    ` : ''}

    <div class="section">
        <h2>📈 Performance Statistics</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>Processing Performance</h3>
                <p><strong>Processing Rate:</strong> ${report.statistics.processingRate} files/sec</p>
                <p><strong>Text Density:</strong> ${report.statistics.textDensity.toFixed(2)} strings/file</p>
                <p><strong>Key Efficiency:</strong> ${(report.statistics.keyEfficiency * 100).toFixed(1)}%</p>
            </div>
            <div class="stat-card">
                <h3>Transformation Metrics</h3>
                <p><strong>Translation Completeness:</strong> ${report.statistics.translationCompleteness.toFixed(1)}%</p>
                <p><strong>Code Transformation Rate:</strong> ${report.statistics.codeTransformationRate.toFixed(1)}%</p>
                ${report.statistics.mostComplexFile ? `<p><strong>Most Complex File:</strong> <span class="file-path">${report.statistics.mostComplexFile}</span></p>` : ''}
            </div>
        </div>
    </div>

    ${report.errors.length > 0 ? `
    <div class="section">
        <h2 class="error">❌ Errors (${report.errors.length})</h2>
        <ul>
            ${report.errors.map(error => `<li class="error">${error.message}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${report.warnings.length > 0 ? `
    <div class="section">
        <h2 class="warning">⚠️ Warnings (${report.warnings.length})</h2>
        <ul>
            ${report.warnings.map(warning => `<li class="warning">${warning}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${report.recommendations.length > 0 ? `
    <div class="section">
        <h2>💡 Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="section">
        <h2>⚙️ Configuration Used</h2>
        <div class="collapsible" onclick="toggleCollapsible(this)">
            <strong>📋 Configuration Details (Click to expand)</strong>
        </div>
        <div class="collapsible-content">
            <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(report.metadata.configUsed, null, 2)}
            </pre>
        </div>
    </div>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; text-align: center;">
        <p>Generated by i18n Integration Tool v${report.metadata.version}</p>
        <p>Report generated at ${report.metadata.generatedAt}</p>
    </footer>
</body>
</html>`;
  }

  /**
   * Get CSS class for coverage percentage
   */
  private static getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'coverage-good';
    if (percentage >= 50) return 'coverage-medium';
    return 'coverage-poor';
  }

  /**
   * Generate Markdown report
   */
  private static generateMarkdownReport(report: Report, options: ReportOptions): string {
    const lines = [
      '# i18n Integration Report',
      '',
      `**Generated:** ${report.metadata.generatedAt}`,
      `**Status:** ${report.metadata.success ? '✅ Success' : '❌ Failed'}`,
      `**Execution Time:** ${this.formatDuration(report.metadata.executionTime)}`,
      '',
      '## Summary',
      '',
      `- **Files Processed:** ${report.summary.processedFiles}/${report.summary.totalFiles}`,
      `- **Text Matches Found:** ${report.summary.foundStrings}`,
      `- **Keys Generated:** ${report.summary.generatedKeys}`,
      `- **Files Transformed:** ${report.summary.transformedFiles}`,
      `- **Errors:** ${report.summary.errors}`,
      `- **Warnings:** ${report.summary.warnings}`,
      ''
    ];

    if (report.errors.length > 0) {
      lines.push('## Errors', '');
      report.errors.forEach(error => {
        lines.push(`- ${error.message}`);
      });
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations', '');
      report.recommendations.forEach(rec => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate CSV report
   */
  private static generateCSVReport(report: Report, options: ReportOptions): string {
    const lines = [
      'Metric,Value',
      `Generated At,${report.metadata.generatedAt}`,
      `Success,${report.metadata.success}`,
      `Execution Time (ms),${report.metadata.executionTime}`,
      `Files Processed,${report.summary.processedFiles}`,
      `Total Files,${report.summary.totalFiles}`,
      `Strings Found,${report.summary.foundStrings}`,
      `Keys Generated,${report.summary.generatedKeys}`,
      `Files Transformed,${report.summary.transformedFiles}`,
      `Errors,${report.summary.errors}`,
      `Warnings,${report.summary.warnings}`
    ];

    return lines.join('\n');
  }

  /**
   * Generate missing translations report
   */
  static async generateMissingTranslationsReport(
    scanResult: ScanResult,
    translationFiles: Record<string, Record<string, string>>,
    options: ReportOptions
  ): Promise<string> {
    const missingReport = this.analyzeMissingTranslations(scanResult, translationFiles);
    
    const report: Partial<Report> = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        executionTime: 0,
        success: true,
        configUsed: {}
      },
      missingTranslations: missingReport,
      recommendations: missingReport.suggestions
    };

    switch (options.format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateMissingTranslationsHTML(missingReport);
      case 'markdown':
        return this.generateMissingTranslationsMarkdown(missingReport);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Generate orphaned keys report
   */
  static async generateOrphanedKeysReport(
    translationFiles: Record<string, Record<string, string>>,
    usedKeys: string[],
    options: ReportOptions
  ): Promise<string> {
    const orphanedReport = this.analyzeOrphanedKeys(translationFiles, usedKeys);
    
    const report: Partial<Report> = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        executionTime: 0,
        success: true,
        configUsed: {}
      },
      orphanedKeys: orphanedReport,
      recommendations: orphanedReport.cleanupSuggestions
    };

    switch (options.format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateOrphanedKeysHTML(orphanedReport);
      case 'markdown':
        return this.generateOrphanedKeysMarkdown(orphanedReport);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Analyze missing translations
   */
  private static analyzeMissingTranslations(
    scanResult: ScanResult,
    translationFiles: Record<string, Record<string, string>>
  ): MissingTranslationReport {
    const missingByLocale: Record<string, string[]> = {};
    const missingByFile: Record<string, string[]> = {};
    const criticalMissing: string[] = [];

    // Initialize locale arrays
    Object.keys(translationFiles).forEach(locale => {
      missingByLocale[locale] = [];
    });

    // Analyze each text match to find missing translations
    scanResult.matches.forEach(match => {
      // This would need actual key mapping from the transformation results
      // For now, we'll simulate the analysis
      const potentialKey = this.generateKeyFromText(match.text);
      
      Object.entries(translationFiles).forEach(([locale, translations]) => {
        if (!translations[potentialKey]) {
          missingByLocale[locale].push(potentialKey);
          
          if (!missingByFile[match.filePath]) {
            missingByFile[match.filePath] = [];
          }
          missingByFile[match.filePath].push(potentialKey);
        }
      });

      // Check if missing in all locales (critical)
      const missingInAll = Object.values(translationFiles).every(translations => 
        !translations[potentialKey]
      );
      
      if (missingInAll) {
        criticalMissing.push(potentialKey);
      }
    });

    const totalMissing = Object.values(missingByLocale).reduce((sum, keys) => sum + keys.length, 0);
    
    return {
      totalMissing,
      missingByLocale,
      missingByFile,
      criticalMissing,
      suggestions: this.generateMissingTranslationSuggestions(totalMissing, criticalMissing.length)
    };
  }

  /**
   * Analyze orphaned keys
   */
  private static analyzeOrphanedKeys(
    translationFiles: Record<string, Record<string, string>>,
    usedKeys: string[]
  ): OrphanedKeyReport {
    const orphanedByLocale: Record<string, string[]> = {};
    const potentialOrphans: string[] = [];

    Object.entries(translationFiles).forEach(([locale, translations]) => {
      const orphaned = Object.keys(translations).filter(key => !usedKeys.includes(key));
      orphanedByLocale[locale] = orphaned;
      
      // Add to potential orphans if not already there
      orphaned.forEach(key => {
        if (!potentialOrphans.includes(key)) {
          potentialOrphans.push(key);
        }
      });
    });

    const totalOrphaned = Object.values(orphanedByLocale).reduce((sum, keys) => sum + keys.length, 0);

    return {
      totalOrphaned,
      orphanedByLocale,
      potentialOrphans,
      cleanupSuggestions: this.generateOrphanedKeySuggestions(totalOrphaned, potentialOrphans.length)
    };
  }

  /**
   * Generate key from text (simplified version)
   */
  private static generateKeyFromText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  /**
   * Generate missing translation suggestions
   */
  private static generateMissingTranslationSuggestions(totalMissing: number, criticalMissing: number): string[] {
    const suggestions: string[] = [];
    
    if (totalMissing > 0) {
      suggestions.push(`Found ${totalMissing} missing translations that need to be addressed`);
      suggestions.push('Run the key generation process to create translation entries for missing keys');
      suggestions.push('Review generated keys and provide appropriate translations for each locale');
    }
    
    if (criticalMissing > 0) {
      suggestions.push(`${criticalMissing} keys are completely missing from all translation files - these are critical`);
      suggestions.push('Prioritize providing translations for critical missing keys to avoid runtime errors');
    }
    
    if (totalMissing > 50) {
      suggestions.push('Consider breaking down translation work into smaller batches for better management');
    }

    return suggestions;
  }

  /**
   * Generate orphaned key suggestions
   */
  private static generateOrphanedKeySuggestions(totalOrphaned: number, potentialOrphans: number): string[] {
    const suggestions: string[] = [];
    
    if (totalOrphaned > 0) {
      suggestions.push(`Found ${totalOrphaned} potentially orphaned translation keys`);
      suggestions.push('Review orphaned keys carefully before removing - some may be used dynamically');
      suggestions.push('Consider keeping keys that might be used in future features or dynamic content');
    }
    
    if (potentialOrphans > 20) {
      suggestions.push('Large number of orphaned keys detected - consider a systematic cleanup approach');
      suggestions.push('Create a backup of translation files before removing orphaned keys');
    }

    return suggestions;
  }

  /**
   * Generate HTML report for missing translations
   */
  private static generateMissingTranslationsHTML(report: MissingTranslationReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Missing Translations Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚠️ Missing Translations Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p class="warning">Total Missing: ${report.totalMissing}</p>
        <p class="error">Critical Missing: ${report.criticalMissing.length}</p>
    </div>
    
    <div class="section">
        <h2>Missing by Locale</h2>
        <table>
            <tr><th>Locale</th><th>Missing Count</th><th>Sample Missing Keys</th></tr>
            ${Object.entries(report.missingByLocale).map(([locale, keys]) => `
            <tr>
                <td>${locale}</td>
                <td class="warning">${keys.length}</td>
                <td>${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}</td>
            </tr>
            `).join('')}
        </table>
    </div>

    ${report.suggestions.length > 0 ? `
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${report.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Generate Markdown report for missing translations
   */
  private static generateMissingTranslationsMarkdown(report: MissingTranslationReport): string {
    const lines = [
      '# Missing Translations Report',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Total Missing:** ${report.totalMissing}`,
      `**Critical Missing:** ${report.criticalMissing.length}`,
      '',
      '## Missing by Locale',
      ''
    ];

    Object.entries(report.missingByLocale).forEach(([locale, keys]) => {
      lines.push(`### ${locale} (${keys.length} missing)`);
      lines.push('');
      if (keys.length > 0) {
        lines.push('```');
        lines.push(...keys.slice(0, 10));
        if (keys.length > 10) {
          lines.push(`... and ${keys.length - 10} more`);
        }
        lines.push('```');
        lines.push('');
      }
    });

    if (report.suggestions.length > 0) {
      lines.push('## Recommendations', '');
      report.suggestions.forEach(suggestion => {
        lines.push(`- ${suggestion}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Generate HTML report for orphaned keys
   */
  private static generateOrphanedKeysHTML(report: OrphanedKeyReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Orphaned Keys Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .info { color: #17a2b8; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🗑️ Orphaned Keys Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p class="info">Total Orphaned: ${report.totalOrphaned}</p>
        <p class="info">Potential Orphans: ${report.potentialOrphans.length}</p>
    </div>
    
    <div class="section">
        <h2>Orphaned by Locale</h2>
        <table>
            <tr><th>Locale</th><th>Orphaned Count</th><th>Sample Orphaned Keys</th></tr>
            ${Object.entries(report.orphanedByLocale).map(([locale, keys]) => `
            <tr>
                <td>${locale}</td>
                <td class="info">${keys.length}</td>
                <td>${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}</td>
            </tr>
            `).join('')}
        </table>
    </div>

    ${report.cleanupSuggestions.length > 0 ? `
    <div class="section">
        <h2>Cleanup Suggestions</h2>
        <ul>
            ${report.cleanupSuggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Generate Markdown report for orphaned keys
   */
  private static generateOrphanedKeysMarkdown(report: OrphanedKeyReport): string {
    const lines = [
      '# Orphaned Keys Report',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Total Orphaned:** ${report.totalOrphaned}`,
      `**Potential Orphans:** ${report.potentialOrphans.length}`,
      '',
      '## Orphaned by Locale',
      ''
    ];

    Object.entries(report.orphanedByLocale).forEach(([locale, keys]) => {
      lines.push(`### ${locale} (${keys.length} orphaned)`);
      lines.push('');
      if (keys.length > 0) {
        lines.push('```');
        lines.push(...keys.slice(0, 10));
        if (keys.length > 10) {
          lines.push(`... and ${keys.length - 10} more`);
        }
        lines.push('```');
        lines.push('');
      }
    });

    if (report.cleanupSuggestions.length > 0) {
      lines.push('## Cleanup Suggestions', '');
      report.cleanupSuggestions.forEach(suggestion => {
        lines.push(`- ${suggestion}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Get default output path for report format
   */
  private static getDefaultOutputPath(format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `i18n-report-${timestamp}.${format}`;
  }

  /**
   * Format duration in human-readable format
   */
  private static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }
}