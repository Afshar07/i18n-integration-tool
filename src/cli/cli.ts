import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { logger, ConfigManager } from '../utils';
import { FileScanner } from '../scanner';
import { KeyManager } from '../generator';
import { FileProcessor } from '../processor';
import { TranslationManager } from '../manager';
import { WorkflowOrchestrator, ReportGenerator } from '../orchestrator';
import { I18nIntegrationConfig, ScanResult, ProcessingState } from '../types';

/**
 * Command-line interface for the i18n integration tool
 */
export class CLI {
  private program: Command;
  private configManager: ConfigManager;
  private config: I18nIntegrationConfig;

  constructor() {
    this.program = new Command();
    this.configManager = new ConfigManager();
    this.config = {} as I18nIntegrationConfig;
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('i18n-integrate')
      .description('Automated i18n integration tool for Nuxt.js applications')
      .version('1.0.0')
      .option('-c, --config <path>', 'path to configuration file')
      .option('-v, --verbose', 'enable verbose logging')
      .option('--dry-run', 'perform a dry run without making changes')
      .hook('preAction', async (thisCommand) => {
        await this.initializeConfig(thisCommand.opts());
      });

    this.setupScanCommand();
    this.setupGenerateCommand();
    this.setupTransformCommand();
    this.setupValidateCommand();
    this.setupNuxtValidateCommand();
    this.setupReportCommand();
    this.setupFullCommand();
    this.setupConfigCommand();
  }

  private setupScanCommand(): void {
    this.program
      .command('scan')
      .description('Scan source files for Persian/Arabic text strings')
      .option('-d, --directories <dirs...>', 'directories to scan (overrides config)')
      .option('-e, --exclude <patterns...>', 'patterns to exclude (overrides config)')
      .option('-o, --output <file>', 'output scan results to file')
      .option('--format <format>', 'output format (json|table)', 'table')
      .action(async (options) => {
        await this.handleScanCommand(options);
      });
  }

  private setupGenerateCommand(): void {
    this.program
      .command('generate')
      .description('Generate translation keys from scanned text')
      .option('-i, --input <file>', 'input scan results file')
      .option('-o, --output <file>', 'output generated keys file')
      .option('--strategy <strategy>', 'key generation strategy (semantic|hash|sequential)')
      .option('--max-length <length>', 'maximum key length', '50')
      .option('--no-context', 'disable context-aware key generation')
      .action(async (options) => {
        await this.handleGenerateCommand(options);
      });
  }

  private setupTransformCommand(): void {
    this.program
      .command('transform')
      .description('Transform source files by replacing text with i18n calls')
      .option('-i, --input <file>', 'input generated keys file')
      .option('-d, --directories <dirs...>', 'directories to transform (overrides config)')
      .option('--backup', 'create backups before transformation')
      .option('--no-backup', 'skip creating backups')
      .action(async (options) => {
        await this.handleTransformCommand(options);
      });
  }

  private setupValidateCommand(): void {
    this.program
      .command('validate')
      .description('Validate i18n integration and translation completeness')
      .option('-d, --directories <dirs...>', 'directories to validate (overrides config)')
      .option('--check-keys', 'check for missing translation keys')
      .option('--check-syntax', 'validate transformed code syntax')
      .option('--check-duplicates', 'check for duplicate translations')
      .option('--check-replaced', 'check for unreplaced Persian/Arabic strings')
      .option('--check-imports', 'check for proper i18n imports and setup')
      .option('-o, --output <file>', 'output detailed validation report to file')
      .option('--format <format>', 'output format (json|html)', 'json')
      .action(async (options) => {
        await this.handleValidateCommand(options);
      });
  }

  private setupNuxtValidateCommand(): void {
    this.program
      .command('validate-nuxt')
      .description('Validate Nuxt.js i18n integration with runtime testing')
      .option('--test-locale-switching', 'test locale switching functionality', true)
      .option('--test-fallback', 'test fallback mechanisms', true)
      .option('--test-hot-reload', 'test hot-reloading functionality', true)
      .option('--timeout <ms>', 'test timeout in milliseconds', '30000')
      .option('--nuxt-config <path>', 'path to nuxt.config.ts file', 'nuxt.config.ts')
      .option('--translations-path <path>', 'path to translation files directory', 'assets/locales')
      .option('-o, --output <file>', 'output detailed validation report to file')
      .option('--format <format>', 'output format (json|html)', 'json')
      .action(async (options) => {
        await this.handleNuxtValidateCommand(options);
      });
  }

  private setupReportCommand(): void {
    const reportCmd = this.program
      .command('report')
      .description('Generate comprehensive reports for i18n integration analysis');

    reportCmd
      .command('missing-translations')
      .description('Generate report of missing translations')
      .option('-d, --directories <dirs...>', 'directories to analyze (overrides config)')
      .option('--translations-path <path>', 'path to translation files directory')
      .option('-o, --output <file>', 'output report to file')
      .option('--format <format>', 'output format (json|html|markdown)', 'html')
      .action(async (options) => {
        await this.handleMissingTranslationsReportCommand(options);
      });

    reportCmd
      .command('orphaned-keys')
      .description('Generate report of orphaned translation keys')
      .option('--translations-path <path>', 'path to translation files directory')
      .option('--scan-code', 'scan code to identify used keys', true)
      .option('-o, --output <file>', 'output report to file')
      .option('--format <format>', 'output format (json|html|markdown)', 'html')
      .action(async (options) => {
        await this.handleOrphanedKeysReportCommand(options);
      });

    reportCmd
      .command('comprehensive')
      .description('Generate comprehensive i18n integration report')
      .option('-i, --input <file>', 'input workflow result file (JSON)')
      .option('-d, --directories <dirs...>', 'directories to analyze (overrides config)')
      .option('-o, --output <file>', 'output report to file')
      .option('--format <format>', 'output format (json|html|markdown)', 'html')
      .option('--include-validation', 'include validation results in report', true)
      .action(async (options) => {
        await this.handleComprehensiveReportCommand(options);
      });
  }

  private setupFullCommand(): void {
    this.program
      .command('full')
      .description('Run complete i18n integration workflow (scan → generate → transform → validate)')
      .option('-d, --directories <dirs...>', 'directories to process (overrides config)')
      .option('-e, --exclude <patterns...>', 'patterns to exclude (overrides config)')
      .option('--skip-validation', 'skip final validation step')
      .option('--interactive', 'prompt for confirmation at each step')
      .action(async (options) => {
        await this.handleFullCommand(options);
      });
  }

  private setupConfigCommand(): void {
    const configCmd = this.program
      .command('config')
      .description('Manage configuration settings');

    configCmd
      .command('init')
      .description('Initialize configuration file with defaults')
      .option('-f, --force', 'overwrite existing configuration')
      .action(async (options) => {
        await this.handleConfigInitCommand(options);
      });

    configCmd
      .command('show')
      .description('Display current configuration')
      .option('--json', 'output as JSON')
      .action(async (options) => {
        await this.handleConfigShowCommand(options);
      });

    configCmd
      .command('set <key> <value>')
      .description('Set a configuration value')
      .action(async (key, value, options) => {
        await this.handleConfigSetCommand(key, value, options);
      });
  }

  private async initializeConfig(globalOptions: any): Promise<void> {
    try {
      // Set config path if provided
      if (globalOptions.config) {
        this.configManager = new ConfigManager(globalOptions.config);
      }

      // Load configuration
      this.config = await this.configManager.load();

      // Apply global options
      if (globalOptions.verbose) {
        const { LogLevel } = await import('../utils/logger');
        logger.setLevel(LogLevel.DEBUG);
      }

      if (globalOptions.dryRun) {
        this.config.fileProcessing.dryRun = true;
        logger.info(chalk.yellow('🔍 Running in dry-run mode - no files will be modified'));
      }

    } catch (error) {
      logger.error(`Failed to initialize configuration: ${error}`);
      process.exit(1);
    }
  }

  private async handleScanCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('📊 Scanning for Persian/Arabic Text');

      // Override config with command options
      const scanConfig = { ...this.config };
      if (options.directories) {
        scanConfig.sourceDirectories = options.directories;
      }
      if (options.exclude) {
        scanConfig.excludePatterns = [...scanConfig.excludePatterns, ...options.exclude];
      }

      // Initialize scanner
      const scanner = new FileScanner(scanConfig);

      // Show progress
      this.showProgress('Scanning files...', 0);

      // Perform scan
      const result = await scanner.scan();

      this.showProgress('Scanning complete', 100);
      this.showScanResults(result);

      // Save results if output specified
      if (options.output) {
        await this.saveResults(result, options.output, options.format);
        logger.info(`📁 Results saved to: ${options.output}`);
      }

    } catch (error) {
      logger.error(`Scan failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleGenerateCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('🔑 Generating Translation Keys');

      // Load scan results
      let scanResult: ScanResult;
      if (options.input) {
        scanResult = await this.loadResults(options.input);
      } else {
        logger.info('No input file specified, running scan first...');
        const scanner = new FileScanner(this.config);
        scanResult = await scanner.scan();
      }

      // Override config with command options
      const keyConfig = { ...this.config.keyGeneration };
      if (options.strategy) {
        keyConfig.strategy = options.strategy;
      }
      if (options.maxLength) {
        keyConfig.maxLength = parseInt(options.maxLength);
      }
      if (options.context === false) {
        keyConfig.useContext = false;
      }

      // Initialize key manager
      const keyManager = new KeyManager(keyConfig);

      this.showProgress('Generating keys...', 0);

      // Generate keys
      const generatedKeys = await keyManager.generateKeys(scanResult.matches);

      this.showProgress('Key generation complete', 100);
      this.showKeyGenerationResults(generatedKeys);

      // Save results if output specified
      if (options.output) {
        await this.saveResults(generatedKeys, options.output, 'json');
        logger.info(`📁 Generated keys saved to: ${options.output}`);
      }

    } catch (error) {
      logger.error(`Key generation failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleTransformCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('🔄 Transforming Source Files');

      // Load generated keys
      let generatedKeys: any;
      if (options.input) {
        generatedKeys = await this.loadResults(options.input);
      } else {
        logger.error('Input file with generated keys is required for transformation');
        process.exit(1);
      }

      // Override config with command options
      const transformConfig = { ...this.config };
      if (options.directories) {
        transformConfig.sourceDirectories = options.directories;
      }
      if (options.backup !== undefined) {
        transformConfig.fileProcessing.createBackups = options.backup;
      }

      // Initialize file processor
      const processor = new FileProcessor(transformConfig);

      this.showProgress('Transforming files...', 0);

      // Validate generated keys format
      if (!Array.isArray(generatedKeys)) {
        throw new Error(`Expected an array of generated keys, but got: ${typeof generatedKeys}`);
      }

      if (generatedKeys.length === 0) {
        logger.warn('No generated keys found in input file. Nothing to transform.');
        return;
      }

      logger.info(`Transforming files using ${generatedKeys.length} generated keys`);

      // Perform transformation
      const results = await processor.transformFiles(generatedKeys);

      this.showProgress('Transformation complete', 100);
      this.showTransformationResults(results);

    } catch (error) {
      logger.error(`Transformation failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleValidateCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('✅ Validating i18n Integration');

      // Override config with command options
      const validateConfig = { ...this.config };
      if (options.directories) {
        validateConfig.sourceDirectories = options.directories;
      }

      // Use the comprehensive validation system
      const { ValidationSystem } = await import('../validator');
      const validationSystem = new ValidationSystem(validateConfig);

      this.showProgress('Running comprehensive validation...', 0);

      // Perform comprehensive validation
      const comprehensiveResult = await validationSystem.validateIntegration({
        checkReplacedStrings: options.checkReplaced !== false,
        checkTranslationKeys: options.checkKeys !== false,
        checkSyntax: options.checkSyntax !== false,
        checkImports: options.checkImports !== false
      });

      this.showProgress('Validation complete', 100);
      this.showComprehensiveValidationResults(comprehensiveResult);

      // Also run translation file validation
      const translationManager = new TranslationManager(validateConfig);
      const translationValidation = await translationManager.validateIntegration({
        checkKeys: options.checkKeys !== false,
        checkSyntax: false, // Already checked above
        checkDuplicates: options.checkDuplicates !== false,
        checkReplacedStrings: false, // Already checked above
        checkImports: false // Already checked above
      });

      // Combine results for final status
      const finalResult = {
        isValid: comprehensiveResult.isValid && translationValidation.isValid,
        errors: [...comprehensiveResult.errors, ...translationValidation.errors],
        warnings: [...comprehensiveResult.warnings, ...translationValidation.warnings],
        suggestions: [...comprehensiveResult.suggestions, ...translationValidation.suggestions]
      };

      // Save detailed report if output specified
      if (options.output) {
        const { ReportGenerator } = await import('../orchestrator');
        await ReportGenerator.saveValidationReport(comprehensiveResult, {
          format: options.format,
          outputPath: options.output,
          includeDetails: true,
          includeStatistics: true,
          includeRecommendations: true
        }, validateConfig);
        logger.info(`📁 Comprehensive validation report saved to: ${options.output}`);
      }

      // Exit with error code if validation failed
      if (!finalResult.isValid) {
        process.exit(1);
      }

    } catch (error) {
      logger.error(`Validation failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleNuxtValidateCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('🚀 Validating Nuxt.js i18n Integration');

      // Use the comprehensive validation system with Nuxt integration
      const { ValidationSystem } = await import('../validator');
      const validationSystem = new ValidationSystem(this.config);

      this.showProgress('Running Nuxt.js integration validation...', 0);

      // Perform Nuxt integration validation
      const nuxtResult = await validationSystem.validateNuxtIntegration({
        testLocaleSwitching: options.testLocaleSwitching !== false,
        testFallbackMechanisms: options.testFallback !== false,
        testHotReloading: options.testHotReload !== false,
        testTimeout: parseInt(options.timeout),
        nuxtConfigPath: options.nuxtConfig,
        translationFilesPath: options.translationsPath
      });

      this.showProgress('Nuxt.js validation complete', 100);
      this.showNuxtValidationResults(nuxtResult);

      // Save detailed report if output specified
      if (options.output) {
        await this.saveNuxtValidationReport(nuxtResult, options.output, options.format);
        logger.info(`📁 Detailed Nuxt validation report saved to: ${options.output}`);
      }

      // Exit with error code if validation failed
      if (!nuxtResult.isValid) {
        process.exit(1);
      }

    } catch (error) {
      logger.error(`Nuxt validation failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleFullCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('🚀 Running Complete i18n Integration Workflow');

      // Override config with command options
      const workflowConfig = { ...this.config };
      if (options.directories) {
        workflowConfig.sourceDirectories = options.directories;
      }
      if (options.exclude) {
        workflowConfig.excludePatterns = [...workflowConfig.excludePatterns, ...options.exclude];
      }

      // Update config manager with overrides
      this.configManager.applyCommandLineOverrides(workflowConfig);

      // Initialize workflow orchestrator
      const orchestrator = new WorkflowOrchestrator(this.configManager);

      // Execute workflow
      const result = await orchestrator.executeWorkflow({
        skipValidation: options.skipValidation,
        interactive: options.interactive,
        continueOnError: false,
        saveIntermediateResults: true
      });

      // Generate and save report
      const reportPath = await ReportGenerator.saveReport(result, {
        format: 'html',
        includeDetails: true,
        includeStatistics: true,
        includeRecommendations: true
      });

      // Show summary
      console.log(ReportGenerator.generateSummaryReport(result));

      if (result.success) {
        logger.info(chalk.green('\n🎉 i18n integration workflow completed successfully!'));
        logger.info(chalk.blue(`📋 Detailed report saved to: ${reportPath}`));
      } else {
        logger.error(chalk.red('\n❌ Workflow completed with errors'));
        logger.info(chalk.blue(`📋 Error report saved to: ${reportPath}`));
        process.exit(1);
      }

    } catch (error) {
      logger.error(`Workflow failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleMissingTranslationsReportCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('📊 Generating Missing Translations Report');

      // Override config with command options
      const reportConfig = { ...this.config };
      if (options.directories) {
        reportConfig.sourceDirectories = options.directories;
      }

      // Scan for text matches
      const { FileScanner } = await import('../scanner');
      const scanner = new FileScanner(reportConfig);
      const scanResult = await scanner.scan();

      // Load translation files
      const translationFiles = await this.loadTranslationFiles(
        options.translationsPath || reportConfig.translationFiles.directory
      );

      // Generate report
      const { ReportGenerator } = await import('../orchestrator');
      const reportContent = await ReportGenerator.generateMissingTranslationsReport(
        scanResult,
        translationFiles,
        {
          format: options.format,
          outputPath: options.output,
          includeDetails: true,
          includeStatistics: true,
          includeRecommendations: true
        }
      );

      // Save or display report
      if (options.output) {
        const { FileOperations } = await import('../utils');
        await FileOperations.writeFile(options.output, reportContent);
        logger.info(`📁 Missing translations report saved to: ${options.output}`);
      } else {
        console.log(reportContent);
      }

    } catch (error) {
      logger.error(`Missing translations report generation failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleOrphanedKeysReportCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('🗑️ Generating Orphaned Keys Report');

      // Load translation files
      const translationFiles = await this.loadTranslationFiles(
        options.translationsPath || this.config.translationFiles.directory
      );

      // Get used keys by scanning code (if requested)
      let usedKeys: string[] = [];
      if (options.scanCode) {
        usedKeys = await this.extractUsedKeys();
      }

      // Generate report
      const { ReportGenerator } = await import('../orchestrator');
      const reportContent = await ReportGenerator.generateOrphanedKeysReport(
        translationFiles,
        usedKeys,
        {
          format: options.format,
          outputPath: options.output,
          includeDetails: true,
          includeStatistics: true,
          includeRecommendations: true
        }
      );

      // Save or display report
      if (options.output) {
        const { FileOperations } = await import('../utils');
        await FileOperations.writeFile(options.output, reportContent);
        logger.info(`📁 Orphaned keys report saved to: ${options.output}`);
      } else {
        console.log(reportContent);
      }

    } catch (error) {
      logger.error(`Orphaned keys report generation failed: ${error}`);
      process.exit(1);
    }
  }

  private async handleComprehensiveReportCommand(options: any): Promise<void> {
    try {
      this.showCommandHeader('📋 Generating Comprehensive i18n Report');

      let workflowResult: any;

      if (options.input) {
        // Load workflow result from file
        workflowResult = await this.loadResults(options.input);
      } else {
        // Run full workflow to generate comprehensive data
        logger.info('No input file specified, running full workflow analysis...');

        const { WorkflowOrchestrator } = await import('../orchestrator');
        const orchestrator = new WorkflowOrchestrator(this.configManager);

        workflowResult = await orchestrator.executeWorkflow({
          skipValidation: !options.includeValidation,
          saveIntermediateResults: false,
          continueOnError: true
        });
      }

      // Generate comprehensive report
      const { ReportGenerator } = await import('../orchestrator');
      const reportContent = await ReportGenerator.generateReport(
        workflowResult,
        {
          format: options.format,
          outputPath: options.output,
          includeDetails: true,
          includeStatistics: true,
          includeRecommendations: true
        },
        this.config
      );

      // Save or display report
      if (options.output) {
        const { FileOperations } = await import('../utils');
        await FileOperations.writeFile(options.output, reportContent);
        logger.info(`📁 Comprehensive report saved to: ${options.output}`);
      } else {
        console.log(reportContent);
      }

    } catch (error) {
      logger.error(`Comprehensive report generation failed: ${error}`);
      process.exit(1);
    }
  }

  private async loadTranslationFiles(translationsPath: string): Promise<Record<string, Record<string, string>>> {
    const translationFiles: Record<string, Record<string, string>> = {};

    try {
      const { FileOperations } = await import('../utils');
      // For now, assume common locale files exist
      const files = ['fa.json', 'en.json'].map(f => path.join(translationsPath, f));

      for (const file of files) {
        const locale = path.basename(file, '.json');
        const content = await FileOperations.readFile(file);
        translationFiles[locale] = JSON.parse(content);
      }

    } catch (error) {
      logger.warn(`Failed to load translation files from ${translationsPath}: ${error}`);
    }

    return translationFiles;
  }

  private async extractUsedKeys(): Promise<string[]> {
    const usedKeys: string[] = [];

    try {
      // This would scan the codebase for $t() calls and extract the keys
      // For now, return empty array as placeholder
      logger.info('Scanning codebase for used translation keys...');

      // Implementation would use the scanner to find $t() calls
      // and extract the key parameters

    } catch (error) {
      logger.warn(`Failed to extract used keys: ${error}`);
    }

    return usedKeys;
  }

  private async handleConfigInitCommand(options: any): Promise<void> {
    try {
      // Check if config exists and force flag
      const configExists = await this.configManager.getConfig();
      if (configExists && !options.force) {
        logger.warn('Configuration file already exists. Use --force to overwrite.');
        return;
      }

      await this.configManager.save();
      logger.info(chalk.green('✅ Configuration file initialized successfully'));

    } catch (error) {
      logger.error(`Failed to initialize configuration: ${error}`);
      process.exit(1);
    }
  }

  private async handleConfigShowCommand(options: any): Promise<void> {
    try {
      const config = this.configManager.getConfig();

      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        this.showConfigTable(config);
      }

    } catch (error) {
      logger.error(`Failed to show configuration: ${error}`);
      process.exit(1);
    }
  }

  private async handleConfigSetCommand(key: string, value: string, options: any): Promise<void> {
    try {
      // Parse the key path (e.g., "keyGeneration.maxLength")
      const keyPath = key.split('.');
      const updates: any = {};

      // Build nested object
      let current = updates;
      for (let i = 0; i < keyPath.length - 1; i++) {
        current[keyPath[i]] = {};
        current = current[keyPath[i]];
      }

      // Set the final value (try to parse as number/boolean)
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);

      current[keyPath[keyPath.length - 1]] = parsedValue;

      this.configManager.updateConfig(updates);
      await this.configManager.save();

      logger.info(chalk.green(`✅ Configuration updated: ${key} = ${value}`));

    } catch (error) {
      logger.error(`Failed to set configuration: ${error}`);
      process.exit(1);
    }
  }

  // Helper methods for display and interaction
  private showCommandHeader(title: string): void {
    console.log(chalk.cyan(`\n${'='.repeat(50)}`));
    console.log(chalk.cyan.bold(title));
    console.log(chalk.cyan(`${'='.repeat(50)}\n`));
  }

  private showProgress(message: string, percentage: number): void {
    const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    process.stdout.write(`\r${message} [${bar}] ${percentage}%`);
    if (percentage === 100) {
      console.log(); // New line when complete
    }
  }

  private showScanResults(result: ScanResult): void {
    console.log(chalk.green(`\n✅ Scan completed:`));
    console.log(`   📁 Files processed: ${result.processedFiles}`);
    console.log(`   📝 Text matches found: ${result.matches.length}`);
    if (result.errors.length > 0) {
      console.log(chalk.yellow(`   ⚠️  Errors: ${result.errors.length}`));

      // Show detailed errors
      console.log(chalk.red('\n📋 Error Details:'));
      result.errors.forEach((error, index) => {
        console.log(chalk.red(`   ${index + 1}. ${error}`));
      });

      console.log(chalk.blue('\n💡 Tip: Use --verbose flag for more detailed logging during the scan process.'));
    }
  }

  private showKeyGenerationResults(keys: any[]): void {
    console.log(chalk.green(`\n✅ Key generation completed:`));
    console.log(`   🔑 Keys generated: ${keys.length}`);
  }

  private showTransformationResults(results: any[]): void {
    console.log(chalk.green(`\n✅ Transformation completed:`));
    console.log(`   📝 Files transformed: ${results.length}`);
  }

  private showValidationResults(results: any): void {
    console.log(chalk.green(`\n✅ Validation completed:`));
    if (results.isValid) {
      console.log(chalk.green('   ✅ All checks passed'));
    } else {
      console.log(chalk.yellow(`   ⚠️  Issues found: ${results.errors.length}`));
    }
  }

  private showComprehensiveValidationResults(results: any): void {
    console.log(chalk.green(`\n✅ Comprehensive validation completed:`));

    // Show summary
    console.log(`   📁 Total files: ${results.summary.totalFiles}`);
    console.log(`   ✅ Valid files: ${results.summary.validFiles}`);
    console.log(`   ❌ Files with errors: ${results.summary.filesWithErrors}`);

    if (results.summary.totalUnreplacedStrings > 0) {
      console.log(chalk.yellow(`   🔤 Unreplaced strings: ${results.summary.totalUnreplacedStrings}`));
    }

    if (results.summary.totalMissingKeys > 0) {
      console.log(chalk.yellow(`   🔑 Missing keys: ${results.summary.totalMissingKeys}`));
    }

    if (results.summary.totalSyntaxErrors > 0) {
      console.log(chalk.red(`   💥 Syntax errors: ${results.summary.totalSyntaxErrors}`));
    }

    // Show overall status
    if (results.isValid) {
      console.log(chalk.green('\n   🎉 All validation checks passed!'));
    } else {
      console.log(chalk.red(`\n   ❌ Validation failed with ${results.errors.length} errors`));

      // Show first few errors
      if (results.errors.length > 0) {
        console.log(chalk.red('\n   First few errors:'));
        results.errors.slice(0, 5).forEach((error: string, index: number) => {
          console.log(chalk.red(`   ${index + 1}. ${error}`));
        });

        if (results.errors.length > 5) {
          console.log(chalk.yellow(`   ... and ${results.errors.length - 5} more errors`));
        }
      }
    }

    // Show suggestions if any
    if (results.suggestions.length > 0) {
      console.log(chalk.blue('\n   💡 Suggestions:'));
      results.suggestions.forEach((suggestion: string, index: number) => {
        console.log(chalk.blue(`   ${index + 1}. ${suggestion}`));
      });
    }
  }

  private showNuxtValidationResults(results: any): void {
    console.log(chalk.green(`\n✅ Nuxt.js integration validation completed:`));

    // Show configuration status
    console.log(`   📋 Nuxt config valid: ${results.nuxtConfigValid ? '✅' : '❌'}`);
    console.log(`   🔧 i18n module configured: ${results.i18nModuleConfigured ? '✅' : '❌'}`);
    console.log(`   📁 Translation files accessible: ${results.translationFilesAccessible ? '✅' : '❌'}`);
    console.log(`   🚀 Dev server started: ${results.devServerStarted ? '✅' : '❌'}`);

    // Show test results
    console.log(chalk.blue('\n🧪 Test Results:'));
    results.testResults.forEach((test: any, index: number) => {
      const status = test.passed ? '✅' : '❌';
      const duration = `(${test.duration}ms)`;
      console.log(`   ${index + 1}. ${status} ${test.testName} ${duration}`);

      if (!test.passed && test.error) {
        console.log(chalk.red(`      Error: ${test.error}`));
      }
    });

    // Show overall status
    if (results.isValid) {
      console.log(chalk.green('\n   🎉 All Nuxt.js integration tests passed!'));
    } else {
      console.log(chalk.red(`\n   ❌ Nuxt.js integration validation failed with ${results.errors.length} errors`));

      // Show first few errors
      if (results.errors.length > 0) {
        console.log(chalk.red('\n   First few errors:'));
        results.errors.slice(0, 3).forEach((error: string, index: number) => {
          console.log(chalk.red(`   ${index + 1}. ${error}`));
        });

        if (results.errors.length > 3) {
          console.log(chalk.yellow(`   ... and ${results.errors.length - 3} more errors`));
        }
      }
    }

    // Show suggestions if any
    if (results.suggestions.length > 0) {
      console.log(chalk.blue('\n   💡 Suggestions:'));
      results.suggestions.forEach((suggestion: string, index: number) => {
        console.log(chalk.blue(`   ${index + 1}. ${suggestion}`));
      });
    }
  }

  private showConfigTable(config: I18nIntegrationConfig): void {
    console.log(chalk.blue('\n📋 Current Configuration:'));
    console.log(`   Source Directories: ${config.sourceDirectories.join(', ')}`);
    console.log(`   Source Locale: ${config.locales.source}`);
    console.log(`   Target Locale: ${config.locales.target}`);
    console.log(`   Key Strategy: ${config.keyGeneration.strategy}`);
    console.log(`   Max Key Length: ${config.keyGeneration.maxLength}`);
    console.log(`   Create Backups: ${config.fileProcessing.createBackups}`);
    console.log(`   Translation Directory: ${config.translationFiles.directory}`);
  }

  private async confirmStep(message: string): Promise<boolean> {
    // Simple confirmation - in a real implementation, you'd use a proper prompt library
    console.log(chalk.yellow(`\n${message} (y/N)`));
    return true; // For now, always continue
  }

  private async saveResults(data: any, filePath: string, format: string): Promise<void> {
    try {
      const { FileOperations } = await import('../utils');

      if (format === 'json') {
        await FileOperations.writeFile(filePath, JSON.stringify(data, null, 2));
      } else {
        // For other formats, convert to string representation
        await FileOperations.writeFile(filePath, JSON.stringify(data, null, 2));
      }

      logger.info(`Saving results to ${filePath} in ${format} format`);
    } catch (error) {
      logger.error(`Failed to save results to ${filePath}: ${error}`);
      throw error;
    }
  }

  private async saveValidationReport(data: any, filePath: string, format: string): Promise<void> {
    try {
      const { FileOperations } = await import('../utils');

      if (format === 'json') {
        await FileOperations.writeFile(filePath, JSON.stringify(data, null, 2));
      } else if (format === 'html') {
        const htmlReport = this.generateHtmlValidationReport(data);
        await FileOperations.writeFile(filePath, htmlReport);
      }

      logger.info(`Validation report saved to ${filePath} in ${format} format`);
    } catch (error) {
      logger.warn(`Failed to save validation report: ${error}`);
    }
  }

  private async saveNuxtValidationReport(data: any, filePath: string, format: string): Promise<void> {
    try {
      const { FileOperations } = await import('../utils');

      if (format === 'json') {
        await FileOperations.writeFile(filePath, JSON.stringify(data, null, 2));
      } else if (format === 'html') {
        const htmlReport = this.generateHtmlNuxtValidationReport(data);
        await FileOperations.writeFile(filePath, htmlReport);
      }

      logger.info(`Nuxt validation report saved to ${filePath} in ${format} format`);
    } catch (error) {
      logger.warn(`Failed to save Nuxt validation report: ${error}`);
    }
  }

  private generateHtmlValidationReport(data: any): string {
    const timestamp = new Date().toISOString();
    const status = data.isValid ? 'PASSED' : 'FAILED';
    const statusColor = data.isValid ? '#28a745' : '#dc3545';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>i18n Integration Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .status { font-size: 24px; font-weight: bold; color: ${statusColor}; }
        .summary { margin: 20px 0; }
        .section { margin: 20px 0; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .success { color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>i18n Integration Validation Report</h1>
        <p>Generated: ${timestamp}</p>
        <p class="status">Status: ${status}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Files</td><td>${data.summary.totalFiles}</td></tr>
            <tr><td>Valid Files</td><td class="success">${data.summary.validFiles}</td></tr>
            <tr><td>Files with Errors</td><td class="error">${data.summary.filesWithErrors}</td></tr>
            <tr><td>Unreplaced Strings</td><td class="warning">${data.summary.totalUnreplacedStrings}</td></tr>
            <tr><td>Missing Keys</td><td class="warning">${data.summary.totalMissingKeys}</td></tr>
            <tr><td>Syntax Errors</td><td class="error">${data.summary.totalSyntaxErrors}</td></tr>
        </table>
    </div>

    ${data.errors.length > 0 ? `
    <div class="section">
        <h2 class="error">Errors (${data.errors.length})</h2>
        <ul>
            ${data.errors.map((error: string) => `<li class="error">${error}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${data.warnings.length > 0 ? `
    <div class="section">
        <h2 class="warning">Warnings (${data.warnings.length})</h2>
        <ul>
            ${data.warnings.map((warning: string) => `<li class="warning">${warning}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${data.suggestions.length > 0 ? `
    <div class="section">
        <h2>Suggestions</h2>
        <ul>
            ${data.suggestions.map((suggestion: string) => `<li>${suggestion}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="section">
        <h2>File Details</h2>
        <table>
            <tr>
                <th>File Path</th>
                <th>Status</th>
                <th>Unreplaced Strings</th>
                <th>Missing Keys</th>
                <th>Syntax Errors</th>
            </tr>
            ${data.fileResults.map((file: any) => `
            <tr>
                <td>${file.filePath}</td>
                <td class="${file.isValid ? 'success' : 'error'}">${file.isValid ? 'Valid' : 'Invalid'}</td>
                <td>${file.unreplacedStrings.length}</td>
                <td>${file.missingKeys.length}</td>
                <td>${file.syntaxErrors.length}</td>
            </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>
    `.trim();
  }

  private generateHtmlNuxtValidationReport(data: any): string {
    const timestamp = new Date().toISOString();
    const status = data.isValid ? 'PASSED' : 'FAILED';
    const statusColor = data.isValid ? '#28a745' : '#dc3545';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Nuxt.js i18n Integration Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .status { font-size: 24px; font-weight: bold; color: ${statusColor}; }
        .summary { margin: 20px 0; }
        .section { margin: 20px 0; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .success { color: #28a745; }
        .info { color: #17a2b8; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .test-passed { background-color: #d4edda; }
        .test-failed { background-color: #f8d7da; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Nuxt.js i18n Integration Validation Report</h1>
        <p>Generated: ${timestamp}</p>
        <p class="status">Status: ${status}</p>
    </div>

    <div class="summary">
        <h2>Configuration Status</h2>
        <table>
            <tr><th>Component</th><th>Status</th></tr>
            <tr><td>Nuxt Config Valid</td><td class="${data.nuxtConfigValid ? 'success' : 'error'}">${data.nuxtConfigValid ? '✅ Valid' : '❌ Invalid'}</td></tr>
            <tr><td>i18n Module Configured</td><td class="${data.i18nModuleConfigured ? 'success' : 'error'}">${data.i18nModuleConfigured ? '✅ Configured' : '❌ Not Configured'}</td></tr>
            <tr><td>Translation Files Accessible</td><td class="${data.translationFilesAccessible ? 'success' : 'error'}">${data.translationFilesAccessible ? '✅ Accessible' : '❌ Not Accessible'}</td></tr>
            <tr><td>Dev Server Started</td><td class="${data.devServerStarted ? 'success' : 'error'}">${data.devServerStarted ? '✅ Started' : '❌ Failed to Start'}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Test Results</h2>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Status</th>
                <th>Duration (ms)</th>
                <th>Details</th>
            </tr>
            ${data.testResults.map((test: any) => `
            <tr class="${test.passed ? 'test-passed' : 'test-failed'}">
                <td>${test.testName}</td>
                <td class="${test.passed ? 'success' : 'error'}">${test.passed ? '✅ PASSED' : '❌ FAILED'}</td>
                <td>${test.duration}</td>
                <td>${test.error || test.details ? JSON.stringify(test.details || test.error) : 'No additional details'}</td>
            </tr>
            `).join('')}
        </table>
    </div>

    ${data.errors.length > 0 ? `
    <div class="section">
        <h2 class="error">Errors (${data.errors.length})</h2>
        <ul>
            ${data.errors.map((error: string) => `<li class="error">${error}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${data.warnings.length > 0 ? `
    <div class="section">
        <h2 class="warning">Warnings (${data.warnings.length})</h2>
        <ul>
            ${data.warnings.map((warning: string) => `<li class="warning">${warning}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${data.suggestions.length > 0 ? `
    <div class="section">
        <h2 class="info">Suggestions</h2>
        <ul>
            ${data.suggestions.map((suggestion: string) => `<li class="info">${suggestion}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `.trim();
  }

  private async loadResults(filePath: string): Promise<any> {
    logger.info(`Loading results from ${filePath}`);
    
    try {
      // Check if file exists
      const { FileOperations } = await import('../utils');
      const fileExists = await FileOperations.fileExists(filePath);
      
      if (!fileExists) {
        throw new Error(`Input file not found: ${filePath}`);
      }

      // Read and parse JSON file
      const content = await FileOperations.readFile(filePath);
      const results = JSON.parse(content);
      
      // Validate the structure
      if (!results || typeof results !== 'object') {
        throw new Error(`Invalid JSON format in ${filePath}`);
      }

      // Handle different possible formats
      if (Array.isArray(results)) {
        // Direct array of generated keys
        return results;
      } else if (results.generatedKeys && Array.isArray(results.generatedKeys)) {
        // Wrapped in an object with generatedKeys property
        return results.generatedKeys;
      } else if (results.keys && Array.isArray(results.keys)) {
        // Alternative format with keys property
        return results.keys;
      } else {
        throw new Error(`Expected an array of generated keys, but got: ${typeof results}`);
      }
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON syntax in ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  async run(args: string[]): Promise<void> {
    try {
      await this.program.parseAsync(args);
    } catch (error) {
      logger.error(`CLI execution failed: ${error}`);
      process.exit(1);
    }
  }
}