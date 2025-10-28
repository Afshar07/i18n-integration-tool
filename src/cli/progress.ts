import chalk from 'chalk';

/**
 * Progress reporting utilities for CLI operations
 */
export class ProgressReporter {
  private startTime: number;
  private lastUpdate: number;
  private currentStep: string;
  private totalSteps: number;
  private currentStepIndex: number;

  constructor(totalSteps: number = 1) {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.currentStep = '';
    this.totalSteps = totalSteps;
    this.currentStepIndex = 0;
  }

  /**
   * Start a new step in the process
   */
  startStep(stepName: string, stepIndex?: number): void {
    this.currentStep = stepName;
    if (stepIndex !== undefined) {
      this.currentStepIndex = stepIndex;
    } else {
      this.currentStepIndex++;
    }
    
    const stepProgress = `[${this.currentStepIndex}/${this.totalSteps}]`;
    console.log(chalk.blue(`\n${stepProgress} ${stepName}...`));
    this.lastUpdate = Date.now();
  }

  /**
   * Update progress within current step
   */
  updateProgress(current: number, total: number, message?: string): void {
    const percentage = Math.floor((current / total) * 100);
    const bar = this.createProgressBar(percentage);
    const elapsed = this.formatDuration(Date.now() - this.lastUpdate);
    
    let output = `\r${bar} ${percentage}% (${current}/${total})`;
    if (message) {
      output += ` - ${message}`;
    }
    output += ` [${elapsed}]`;
    
    process.stdout.write(output);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Complete current step
   */
  completeStep(message?: string): void {
    const elapsed = this.formatDuration(Date.now() - this.lastUpdate);
    const totalElapsed = this.formatDuration(Date.now() - this.startTime);
    
    let output = chalk.green(`✅ ${this.currentStep} completed`);
    if (message) {
      output += ` - ${message}`;
    }
    output += chalk.gray(` (${elapsed}, total: ${totalElapsed})`);
    
    console.log(output);
  }

  /**
   * Report an error in current step
   */
  reportError(error: string): void {
    console.log(chalk.red(`❌ ${this.currentStep} failed: ${error}`));
  }

  /**
   * Report a warning in current step
   */
  reportWarning(warning: string): void {
    console.log(chalk.yellow(`⚠️  ${warning}`));
  }

  /**
   * Show final summary
   */
  showSummary(results: {
    success: boolean;
    totalFiles?: number;
    processedFiles?: number;
    errors?: string[];
    warnings?: string[];
  }): void {
    const totalElapsed = this.formatDuration(Date.now() - this.startTime);
    
    console.log(chalk.cyan('\n' + '='.repeat(50)));
    console.log(chalk.cyan.bold('SUMMARY'));
    console.log(chalk.cyan('='.repeat(50)));
    
    if (results.success) {
      console.log(chalk.green('✅ Operation completed successfully'));
    } else {
      console.log(chalk.red('❌ Operation completed with errors'));
    }
    
    console.log(chalk.gray(`⏱️  Total time: ${totalElapsed}`));
    
    if (results.totalFiles !== undefined) {
      console.log(`📁 Total files: ${results.totalFiles}`);
    }
    
    if (results.processedFiles !== undefined) {
      console.log(`📝 Processed files: ${results.processedFiles}`);
    }
    
    if (results.errors && results.errors.length > 0) {
      console.log(chalk.red(`❌ Errors: ${results.errors.length}`));
      results.errors.slice(0, 5).forEach(error => {
        console.log(chalk.red(`   • ${error}`));
      });
      if (results.errors.length > 5) {
        console.log(chalk.red(`   ... and ${results.errors.length - 5} more`));
      }
    }
    
    if (results.warnings && results.warnings.length > 0) {
      console.log(chalk.yellow(`⚠️  Warnings: ${results.warnings.length}`));
      results.warnings.slice(0, 3).forEach(warning => {
        console.log(chalk.yellow(`   • ${warning}`));
      });
      if (results.warnings.length > 3) {
        console.log(chalk.yellow(`   ... and ${results.warnings.length - 3} more`));
      }
    }
    
    console.log(chalk.cyan('='.repeat(50)));
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));
    
    return `[${filledBar}${emptyBar}]`;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
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

/**
 * Spinner utility for long-running operations
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private currentFrame = 0;
  private message: string;

  constructor(message: string = 'Loading...') {
    this.message = message;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(this.frames[this.currentFrame])} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 100);
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    process.stdout.write('\r' + ' '.repeat(this.message.length + 2) + '\r');
    
    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  updateMessage(message: string): void {
    this.message = message;
  }
}

/**
 * Table formatter for displaying structured data
 */
export class TableFormatter {
  static formatScanResults(matches: any[]): void {
    if (matches.length === 0) {
      console.log(chalk.gray('No matches found.'));
      return;
    }

    console.log(chalk.blue('\n📋 Found Text Matches:'));
    console.log(chalk.gray('─'.repeat(80)));
    
    matches.slice(0, 10).forEach((match, index) => {
      console.log(`${index + 1}. ${chalk.yellow(match.text.substring(0, 50))}${match.text.length > 50 ? '...' : ''}`);
      console.log(`   📁 ${chalk.gray(match.filePath)}:${match.lineNumber}`);
      console.log(`   🏷️  ${chalk.cyan(match.context)}`);
      if (index < matches.length - 1) {
        console.log(chalk.gray('   ─'.repeat(40)));
      }
    });
    
    if (matches.length > 10) {
      console.log(chalk.gray(`\n... and ${matches.length - 10} more matches`));
    }
  }

  static formatKeyResults(keys: any[]): void {
    if (keys.length === 0) {
      console.log(chalk.gray('No keys generated.'));
      return;
    }

    console.log(chalk.blue('\n🔑 Generated Translation Keys:'));
    console.log(chalk.gray('─'.repeat(80)));
    
    keys.slice(0, 10).forEach((key, index) => {
      console.log(`${index + 1}. ${chalk.green(key.key)}`);
      console.log(`   📝 ${chalk.gray(key.originalText.substring(0, 60))}${key.originalText.length > 60 ? '...' : ''}`);
      console.log(`   🎯 Confidence: ${chalk.cyan(key.confidence)}%`);
      if (index < keys.length - 1) {
        console.log(chalk.gray('   ─'.repeat(40)));
      }
    });
    
    if (keys.length > 10) {
      console.log(chalk.gray(`\n... and ${keys.length - 10} more keys`));
    }
  }

  static formatValidationResults(results: any): void {
    console.log(chalk.blue('\n✅ Validation Results:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    if (results.isValid) {
      console.log(chalk.green('✅ All validation checks passed'));
    } else {
      console.log(chalk.red('❌ Validation issues found:'));
      
      if (results.errors && results.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        results.errors.forEach((error: string, index: number) => {
          console.log(chalk.red(`  ${index + 1}. ${error}`));
        });
      }
      
      if (results.warnings && results.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        results.warnings.forEach((warning: string, index: number) => {
          console.log(chalk.yellow(`  ${index + 1}. ${warning}`));
        });
      }
    }
    
    if (results.suggestions && results.suggestions.length > 0) {
      console.log(chalk.blue('\nSuggestions:'));
      results.suggestions.forEach((suggestion: string, index: number) => {
        console.log(chalk.blue(`  ${index + 1}. ${suggestion}`));
      });
    }
  }
}