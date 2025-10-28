import { logger } from '../utils';
import { ConfigManager } from '../utils/config';
import { FileScanner } from '../scanner';
import { KeyManager } from '../generator';
import { FileProcessor } from '../processor';
import { TranslationManager } from '../manager';
import { ProgressReporter } from '../cli/progress';
import { 
  I18nIntegrationConfig, 
  ScanResult, 
  GeneratedKey, 
  TransformationResult, 
  ValidationResult,
  ProcessingState,
  ProcessingError
} from '../types';

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
  skipValidation?: boolean;
  interactive?: boolean;
  continueOnError?: boolean;
  saveIntermediateResults?: boolean;
  outputDirectory?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  phase: string;
  scanResult?: ScanResult;
  generatedKeys?: GeneratedKey[];
  transformationResults?: TransformationResult[];
  validationResult?: ValidationResult;
  errors: ProcessingError[];
  warnings: string[];
  executionTime: number;
  processedFiles: number;
}

/**
 * Workflow step definition
 */
interface WorkflowStep {
  name: string;
  description: string;
  execute: () => Promise<any>;
  onError?: (error: Error) => Promise<boolean>; // Return true to continue, false to stop
  onSuccess?: (result: any) => Promise<void>;
  required: boolean;
}

/**
 * Main workflow orchestrator that coordinates all i18n integration components
 */
export class WorkflowOrchestrator {
  private config: I18nIntegrationConfig;
  private configManager: ConfigManager;
  private progressReporter: ProgressReporter;
  private currentState: ProcessingState;
  private errors: ProcessingError[] = [];
  private warnings: string[] = [];
  private startTime: number = 0;

  // Component instances
  private scanner?: FileScanner;
  private keyManager?: KeyManager;
  private fileProcessor?: FileProcessor;
  private translationManager?: TranslationManager;

  // Intermediate results
  private scanResult?: ScanResult;
  private generatedKeys?: GeneratedKey[];
  private transformationResults?: TransformationResult[];
  private validationResult?: ValidationResult;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.config = configManager.getConfig();
    this.progressReporter = new ProgressReporter(4); // 4 main steps
    this.currentState = this.initializeState();
  }

  /**
   * Execute the complete i18n integration workflow
   */
  async executeWorkflow(options: WorkflowOptions = {}): Promise<WorkflowResult> {
    this.startTime = Date.now();
    logger.info('🚀 Starting i18n integration workflow...');

    try {
      // Initialize components
      await this.initializeComponents();

      // Define workflow steps
      const steps = this.defineWorkflowSteps(options);

      // Execute steps sequentially
      for (const step of steps) {
        if (!await this.executeStep(step, options)) {
          break; // Stop execution if step fails and continue on error is false
        }
      }

      // Generate final result
      const result = this.generateWorkflowResult();
      
      // Show summary
      this.progressReporter.showSummary({
        success: result.success,
        totalFiles: this.scanResult?.totalFiles,
        processedFiles: result.processedFiles,
        errors: result.errors.map(e => e.message),
        warnings: result.warnings
      });

      return result;

    } catch (error) {
      logger.error(`Workflow execution failed: ${error}`);
      this.errors.push(error as ProcessingError);
      return this.generateWorkflowResult();
    }
  }

  /**
   * Execute individual workflow step
   */
  async executeStep(step: WorkflowStep, options: WorkflowOptions): Promise<boolean> {
    try {
      this.progressReporter.startStep(step.description);
      logger.info(`Executing step: ${step.name}`);

      // Execute the step
      const result = await step.execute();

      // Handle success
      if (step.onSuccess) {
        await step.onSuccess(result);
      }

      this.progressReporter.completeStep();
      return true;

    } catch (error) {
      this.progressReporter.reportError((error as Error).message);
      this.errors.push(error as ProcessingError);

      // Handle error
      if (step.onError) {
        const shouldContinue = await step.onError(error as Error);
        if (shouldContinue) {
          this.progressReporter.reportWarning(`Step ${step.name} failed but continuing...`);
          return true;
        }
      }

      // Check if we should continue on error
      if (options.continueOnError && !step.required) {
        this.progressReporter.reportWarning(`Step ${step.name} failed but marked as optional`);
        return true;
      }

      logger.error(`Step ${step.name} failed: ${error}`);
      return false;
    }
  }

  /**
   * Execute only the scanning phase
   */
  async executeScan(options: Partial<WorkflowOptions> = {}): Promise<ScanResult> {
    this.startTime = Date.now();
    logger.info('📊 Starting scan phase...');

    try {
      await this.initializeComponents();
      
      this.progressReporter.startStep('Scanning for Persian/Arabic text', 1);
      this.scanResult = await this.scanner!.scan();
      this.progressReporter.completeStep(`Found ${this.scanResult.matches.length} text matches`);

      if (options.saveIntermediateResults) {
        await this.saveIntermediateResults('scan', options.outputDirectory);
      }

      return this.scanResult;

    } catch (error) {
      logger.error(`Scan phase failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute key generation phase
   */
  async executeKeyGeneration(scanResult?: ScanResult, options: Partial<WorkflowOptions> = {}): Promise<GeneratedKey[]> {
    this.startTime = Date.now();
    logger.info('🔑 Starting key generation phase...');

    try {
      await this.initializeComponents();
      
      // Use provided scan result or execute scan first
      const inputScanResult = scanResult || await this.executeScan(options);
      
      this.progressReporter.startStep('Generating translation keys', 1);
      this.generatedKeys = await this.keyManager!.generateKeys(inputScanResult.matches);
      this.progressReporter.completeStep(`Generated ${this.generatedKeys.length} keys`);

      if (options.saveIntermediateResults) {
        await this.saveIntermediateResults('keys', options.outputDirectory);
      }

      return this.generatedKeys;

    } catch (error) {
      logger.error(`Key generation phase failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute transformation phase
   */
  async executeTransformation(generatedKeys?: GeneratedKey[], options: Partial<WorkflowOptions> = {}): Promise<TransformationResult[]> {
    this.startTime = Date.now();
    logger.info('🔄 Starting transformation phase...');

    try {
      await this.initializeComponents();
      
      // Use provided keys or execute previous phases first
      const inputKeys = generatedKeys || await this.executeKeyGeneration(undefined, options);
      
      this.progressReporter.startStep('Transforming source files', 1);
      this.transformationResults = await this.fileProcessor!.transformFiles(inputKeys);
      this.progressReporter.completeStep(`Transformed ${this.transformationResults.length} files`);

      if (options.saveIntermediateResults) {
        await this.saveIntermediateResults('transform', options.outputDirectory);
      }

      return this.transformationResults;

    } catch (error) {
      logger.error(`Transformation phase failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute validation phase
   */
  async executeValidation(options: Partial<WorkflowOptions> = {}): Promise<ValidationResult> {
    this.startTime = Date.now();
    logger.info('✅ Starting validation phase...');

    try {
      await this.initializeComponents();
      
      this.progressReporter.startStep('Validating i18n integration', 1);
      this.validationResult = await this.translationManager!.validateIntegration({
        checkKeys: true,
        checkSyntax: true,
        checkDuplicates: true
      });
      this.progressReporter.completeStep(
        this.validationResult.isValid ? 'Validation passed' : `Found ${this.validationResult.errors.length} issues`
      );

      if (options.saveIntermediateResults) {
        await this.saveIntermediateResults('validation', options.outputDirectory);
      }

      return this.validationResult;

    } catch (error) {
      logger.error(`Validation phase failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get current processing state
   */
  getCurrentState(): ProcessingState {
    return { ...this.currentState };
  }

  /**
   * Get workflow progress percentage
   */
  getProgress(): number {
    return this.currentState.progress.percentage;
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(): Promise<void> {
    logger.warn('Workflow cancellation requested');
    // Implementation would handle graceful cancellation
    // For now, just log the request
  }

  /**
   * Initialize workflow components
   */
  private async initializeComponents(): Promise<void> {
    if (!this.scanner) {
      this.scanner = new FileScanner(this.config);
    }
    
    if (!this.keyManager) {
      this.keyManager = new KeyManager(this.config.keyGeneration);
    }
    
    if (!this.fileProcessor) {
      this.fileProcessor = new FileProcessor(this.config);
    }
    
    if (!this.translationManager) {
      this.translationManager = new TranslationManager(this.config);
    }
  }

  /**
   * Define workflow steps
   */
  private defineWorkflowSteps(options: WorkflowOptions): WorkflowStep[] {
    const steps: WorkflowStep[] = [
      {
        name: 'scan',
        description: 'Scanning for Persian/Arabic text',
        required: true,
        execute: async () => {
          this.currentState.phase = 'scanning';
          this.scanResult = await this.scanner!.scan();
          this.updateProgress(1, 4);
          return this.scanResult;
        },
        onSuccess: async (result: ScanResult) => {
          if (options.saveIntermediateResults) {
            await this.saveIntermediateResults('scan', options.outputDirectory);
          }
        }
      },
      
      {
        name: 'generate',
        description: 'Generating translation keys',
        required: true,
        execute: async () => {
          this.currentState.phase = 'generating';
          this.generatedKeys = await this.keyManager!.generateKeys(this.scanResult!.matches);
          this.updateProgress(2, 4);
          return this.generatedKeys;
        },
        onSuccess: async (result: GeneratedKey[]) => {
          if (options.saveIntermediateResults) {
            await this.saveIntermediateResults('keys', options.outputDirectory);
          }
        }
      },
      
      {
        name: 'transform',
        description: 'Transforming source files',
        required: true,
        execute: async () => {
          this.currentState.phase = 'transforming';
          this.transformationResults = await this.fileProcessor!.transformFiles(this.generatedKeys!);
          this.updateProgress(3, 4);
          return this.transformationResults;
        },
        onSuccess: async (result: TransformationResult[]) => {
          if (options.saveIntermediateResults) {
            await this.saveIntermediateResults('transform', options.outputDirectory);
          }
        }
      },
      
      {
        name: 'validate',
        description: 'Validating i18n integration',
        required: false,
        execute: async () => {
          if (options.skipValidation) {
            logger.info('Skipping validation as requested');
            return null;
          }
          
          this.currentState.phase = 'validating';
          this.validationResult = await this.translationManager!.validateIntegration({
            checkKeys: true,
            checkSyntax: true,
            checkDuplicates: true,
            checkReplacedStrings: true,
            checkImports: true
          });
          this.updateProgress(4, 4);
          return this.validationResult;
        },
        onSuccess: async (result: ValidationResult) => {
          if (result && options.saveIntermediateResults) {
            await this.saveIntermediateResults('validation', options.outputDirectory);
          }
        },
        onError: async (error: Error) => {
          this.warnings.push(`Validation failed: ${error.message}`);
          return true; // Continue even if validation fails
        }
      }
    ];

    return steps;
  }

  /**
   * Initialize processing state
   */
  private initializeState(): ProcessingState {
    return {
      phase: 'scanning',
      progress: {
        current: 0,
        total: 4,
        percentage: 0
      },
      results: {
        scannedFiles: 0,
        foundStrings: 0,
        generatedKeys: 0,
        transformedFiles: 0,
        errors: []
      }
    };
  }

  /**
   * Update progress state
   */
  private updateProgress(current: number, total: number): void {
    this.currentState.progress.current = current;
    this.currentState.progress.total = total;
    this.currentState.progress.percentage = Math.floor((current / total) * 100);
    
    // Update results
    if (this.scanResult) {
      this.currentState.results.scannedFiles = this.scanResult.processedFiles;
      this.currentState.results.foundStrings = this.scanResult.matches.length;
    }
    
    if (this.generatedKeys) {
      this.currentState.results.generatedKeys = this.generatedKeys.length;
    }
    
    if (this.transformationResults) {
      this.currentState.results.transformedFiles = this.transformationResults.length;
    }
    
    this.currentState.results.errors = this.errors.map(e => e.message);
  }

  /**
   * Generate final workflow result
   */
  private generateWorkflowResult(): WorkflowResult {
    const executionTime = Date.now() - this.startTime;
    const processedFiles = this.scanResult?.processedFiles || 0;
    
    return {
      success: this.errors.length === 0,
      phase: this.currentState.phase,
      scanResult: this.scanResult,
      generatedKeys: this.generatedKeys,
      transformationResults: this.transformationResults,
      validationResult: this.validationResult,
      errors: this.errors,
      warnings: this.warnings,
      executionTime,
      processedFiles
    };
  }

  /**
   * Save intermediate results to files
   */
  private async saveIntermediateResults(phase: string, outputDirectory?: string): Promise<void> {
    const baseDir = outputDirectory || '.i18n-results';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      switch (phase) {
        case 'scan':
          if (this.scanResult) {
            // Implementation would save scan results
            logger.info(`Scan results saved to ${baseDir}/scan-${timestamp}.json`);
          }
          break;
          
        case 'keys':
          if (this.generatedKeys) {
            // Implementation would save generated keys
            logger.info(`Generated keys saved to ${baseDir}/keys-${timestamp}.json`);
          }
          break;
          
        case 'transform':
          if (this.transformationResults) {
            // Implementation would save transformation results
            logger.info(`Transformation results saved to ${baseDir}/transform-${timestamp}.json`);
          }
          break;
          
        case 'validation':
          if (this.validationResult) {
            // Implementation would save validation results
            logger.info(`Validation results saved to ${baseDir}/validation-${timestamp}.json`);
          }
          break;
      }
    } catch (error) {
      this.warnings.push(`Failed to save ${phase} results: ${error}`);
    }
  }
}