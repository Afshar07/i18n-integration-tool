import chalk from 'chalk';

/**
 * Logging levels for the i18n integration tool
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

/**
 * Core logging utility for the i18n integration tool
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      prefix: '[i18n-integration]',
      timestamp: true,
      colors: true,
      ...config
    };
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, chalk.gray, ...args);
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log('INFO', message, chalk.blue, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.WARN) {
      this.log('WARN', message, chalk.yellow, ...args);
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, ...args: any[]): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log('ERROR', message, chalk.red, ...args);
      if (error) {
        console.error(chalk.red(error.stack || error.message));
      }
    }
  }

  /**
   * Log success message
   */
  success(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log('SUCCESS', message, chalk.green, ...args);
    }
  }

  /**
   * Log progress message
   */
  progress(message: string, current: number, total: number): void {
    if (this.config.level <= LogLevel.INFO) {
      const percentage = Math.round((current / total) * 100);
      const progressBar = this.createProgressBar(percentage);
      this.log('PROGRESS', `${message} ${progressBar} ${current}/${total} (${percentage}%)`, chalk.cyan);
    }
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  /**
   * Core logging method
   */
  private log(level: string, message: string, colorFn: (text: string) => string, ...args: any[]): void {
    const timestamp = this.config.timestamp ? `[${new Date().toISOString()}]` : '';
    const prefix = this.config.prefix || '';
    const levelStr = `[${level}]`;
    
    const parts = [timestamp, prefix, levelStr].filter(Boolean);
    const prefixStr = parts.join(' ');
    
    if (this.config.colors) {
      console.log(colorFn(`${prefixStr} ${message}`), ...args);
    } else {
      console.log(`${prefixStr} ${message}`, ...args);
    }
  }

  /**
   * Create a child logger with additional prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} ${prefix}`
    });
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable/disable colors
   */
  setColors(enabled: boolean): void {
    this.config.colors = enabled;
  }

  /**
   * Log a separator line
   */
  separator(char: string = '-', length: number = 50): void {
    if (this.config.level <= LogLevel.INFO) {
      console.log(chalk.gray(char.repeat(length)));
    }
  }

  /**
   * Log a table of data
   */
  table(data: Record<string, any>[]): void {
    if (this.config.level <= LogLevel.INFO && data.length > 0) {
      console.table(data);
    }
  }

  /**
   * Log with custom formatting
   */
  custom(formatter: (message: string) => string, message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      console.log(formatter(message), ...args);
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with specific configuration
 */
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(config);
}