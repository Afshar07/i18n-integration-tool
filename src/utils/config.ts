import * as path from 'path';
import { FileOperations } from './file-operations';
import { I18nIntegrationConfig } from '../types';
import { logger } from './logger';
import { ConfigValidator, CONFIG_SCHEMA } from './config-schema';

/**
 * Default configuration for the i18n integration tool
 */
export const DEFAULT_CONFIG: I18nIntegrationConfig = ConfigValidator.getDefaultConfig();

/**
 * Configuration manager for the i18n integration tool
 */
export class ConfigManager {
  private config: I18nIntegrationConfig;
  private configPath: string;
  private commandLineOverrides: Partial<I18nIntegrationConfig>;

  constructor(configPath?: string) {
    this.configPath = configPath || path.resolve(process.cwd(), 'i18n-integration.config.json');
    this.config = { ...DEFAULT_CONFIG };
    this.commandLineOverrides = {};
  }

  /**
   * Load configuration from file or use defaults
   */
  async load(): Promise<I18nIntegrationConfig> {
    try {
      // Try to find config file if not explicitly set
      if (!this.configPath || this.configPath === path.resolve(process.cwd(), 'i18n-integration.config.json')) {
        this.configPath = await this.findConfigFile();
      }
      
      let fileConfig: Partial<I18nIntegrationConfig> = {};
      
      if (await FileOperations.fileExists(this.configPath)) {
        logger.info(`Loading configuration from: ${this.configPath}`);
        fileConfig = await FileOperations.readJsonFile<Partial<I18nIntegrationConfig>>(this.configPath);
      } else {
        logger.info('No configuration file found, using defaults');
      }

      // Merge configurations: defaults < file config < command line overrides
      this.config = this.mergeConfig(
        DEFAULT_CONFIG,
        fileConfig,
        this.commandLineOverrides
      );

      // Validate the final configuration
      const validation = ConfigValidator.validate(this.config);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => logger.warn(`Config warning: ${warning}`));
      }

      // Create default config file if it doesn't exist
      if (!await FileOperations.fileExists(this.configPath)) {
        await this.save();
      }

    } catch (error) {
      logger.error(`Failed to load configuration: ${error}`);
      throw error;
    }

    return this.config;
  }

  /**
   * Save current configuration to file
   */
  async save(): Promise<void> {
    try {
      await FileOperations.writeJsonFile(this.configPath, this.config, 2);
      logger.info(`Configuration saved to: ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): I18nIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<I18nIntegrationConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    
    // Validate updated configuration
    const validation = ConfigValidator.validate(this.config);
    if (!validation.isValid) {
      throw new Error(`Configuration update failed:\n${validation.errors.join('\n')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => logger.warn(`Config warning: ${warning}`));
    }
  }

  /**
   * Set command-line overrides
   */
  setCommandLineOverrides(overrides: Partial<I18nIntegrationConfig>): void {
    this.commandLineOverrides = { ...overrides };
  }

  /**
   * Apply command-line overrides to current config
   */
  applyCommandLineOverrides(overrides: Partial<I18nIntegrationConfig>): void {
    // Merge with existing overrides
    const newOverrides = this.mergeConfig(
      { ...DEFAULT_CONFIG }, // Start with defaults to ensure all required fields
      this.commandLineOverrides,
      overrides
    );
    
    this.commandLineOverrides = newOverrides;
    this.config = this.mergeConfig(this.config, this.commandLineOverrides);
    
    // Validate updated configuration
    const validation = ConfigValidator.validate(this.config);
    if (!validation.isValid) {
      throw new Error(`Command-line override validation failed:\n${validation.errors.join('\n')}`);
    }
  }

  /**
   * Find configuration file in common locations
   */
  private async findConfigFile(): Promise<string> {
    const possiblePaths = [
      'i18n-integration.config.json',
      '.i18n-integration.json',
      'tools/i18n-integration/config.json'
    ];

    for (const configPath of possiblePaths) {
      const fullPath = path.resolve(process.cwd(), configPath);
      if (await FileOperations.fileExists(fullPath)) {
        return fullPath;
      }
    }

    // Default to creating config in project root
    return path.resolve(process.cwd(), 'i18n-integration.config.json');
  }

  /**
   * Deep merge configuration objects (supports multiple sources)
   */
  private mergeConfig(
    base: I18nIntegrationConfig, 
    ...overrides: Partial<I18nIntegrationConfig>[]
  ): I18nIntegrationConfig {
    let result = { ...base };

    for (const override of overrides) {
      for (const [key, value] of Object.entries(override)) {
        if (value !== undefined) {
          if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            // Deep merge objects
            result[key as keyof I18nIntegrationConfig] = {
              ...result[key as keyof I18nIntegrationConfig],
              ...value
            } as any;
          } else {
            // Direct assignment for primitives and arrays
            result[key as keyof I18nIntegrationConfig] = value as any;
          }
        }
      }
    }

    return result;
  }

  /**
   * Get configuration help text
   */
  getConfigHelp(): string {
    return ConfigValidator.getHelpText();
  }

  /**
   * Validate a configuration value by path
   */
  validateConfigValue(path: string, value: any): { isValid: boolean; error?: string } {
    const schema = CONFIG_SCHEMA[path];
    if (!schema) {
      return { isValid: false, error: `Unknown configuration path: ${path}` };
    }

    // Type validation
    if (!this.validateType(value, schema.type)) {
      return { isValid: false, error: `Value must be of type ${schema.type}` };
    }

    // Custom validation
    if (schema.validate) {
      const result = schema.validate(value);
      if (result !== true) {
        return { isValid: false, error: result as string };
      }
    }

    // Options validation
    if (schema.options && !schema.options.includes(value)) {
      return { isValid: false, error: `Value must be one of: ${schema.options.join(', ')}` };
    }

    return { isValid: true };
  }

  /**
   * Get all available configuration paths
   */
  getConfigPaths(): string[] {
    return Object.keys(CONFIG_SCHEMA);
  }

  /**
   * Get configuration schema for a specific path
   */
  getConfigSchema(path: string) {
    return CONFIG_SCHEMA[path];
  }

  /**
   * Export configuration to different formats
   */
  async exportConfig(format: 'json' | 'yaml' | 'env' = 'json'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(this.config, null, 2);
      case 'yaml':
        return this.configToYAML(this.config);
      case 'env':
        return this.configToEnv(this.config);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import configuration from string
   */
  async importConfig(content: string, format: 'json' | 'yaml' = 'json'): Promise<void> {
    let importedConfig: Partial<I18nIntegrationConfig>;

    try {
      switch (format) {
        case 'json':
          importedConfig = JSON.parse(content);
          break;
        case 'yaml':
          importedConfig = this.yamlToConfig(content);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate imported configuration
      const validation = ConfigValidator.validate(importedConfig);
      if (!validation.isValid) {
        throw new Error(`Imported configuration is invalid:\n${validation.errors.join('\n')}`);
      }

      // Merge with current configuration
      this.config = this.mergeConfig(this.config, importedConfig);
      
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.commandLineOverrides = {};
  }

  /**
   * Check if configuration file exists
   */
  async configFileExists(): Promise<boolean> {
    return await FileOperations.fileExists(this.configPath);
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get resolved source directories as absolute paths
   */
  getSourceDirectories(): string[] {
    return this.config.sourceDirectories.map(dir => 
      path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
    );
  }

  /**
   * Get resolved translation files directory
   */
  getTranslationDirectory(): string {
    const dir = this.config.translationFiles.directory;
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  }

  /**
   * Get file patterns for scanning
   */
  getFilePatterns(): string[] {
    const extensions = ['vue', 'js', 'ts', 'jsx', 'tsx'];
    return this.config.sourceDirectories.flatMap(dir =>
      extensions.map(ext => `${dir}/**/*.${ext}`)
    );
  }

  /**
   * Validate value type
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Convert configuration to YAML format (simple implementation)
   */
  private configToYAML(config: I18nIntegrationConfig): string {
    const lines = ['# i18n Integration Configuration', ''];
    
    const addYAMLSection = (obj: any, indent: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          lines.push(`${indent}${key}:`);
          addYAMLSection(value, indent + '  ');
        } else if (Array.isArray(value)) {
          lines.push(`${indent}${key}:`);
          value.forEach(item => {
            lines.push(`${indent}  - ${JSON.stringify(item)}`);
          });
        } else {
          lines.push(`${indent}${key}: ${JSON.stringify(value)}`);
        }
      }
    };
    
    addYAMLSection(config);
    return lines.join('\n');
  }

  /**
   * Convert configuration to environment variables format
   */
  private configToEnv(config: I18nIntegrationConfig): string {
    const lines = ['# i18n Integration Environment Variables', ''];
    
    const addEnvVars = (obj: any, prefix: string = 'I18N_') => {
      for (const [key, value] of Object.entries(obj)) {
        const envKey = `${prefix}${key.toUpperCase()}`;
        
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          addEnvVars(value, `${envKey}_`);
        } else if (Array.isArray(value)) {
          lines.push(`${envKey}="${value.join(',')}"`);
        } else {
          lines.push(`${envKey}="${value}"`);
        }
      }
    };
    
    addEnvVars(config);
    return lines.join('\n');
  }

  /**
   * Convert YAML to configuration (simple implementation)
   */
  private yamlToConfig(yaml: string): Partial<I18nIntegrationConfig> {
    // This is a simplified YAML parser - in production, use a proper YAML library
    const lines = yaml.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    const config: any = {};
    
    let currentPath: string[] = [];
    
    for (const line of lines) {
      const indent = line.length - line.trimStart().length;
      const trimmed = line.trim();
      
      if (trimmed.includes(':')) {
        const [key, value] = trimmed.split(':', 2);
        const cleanKey = key.trim();
        const cleanValue = value?.trim();
        
        // Adjust current path based on indentation
        const depth = Math.floor(indent / 2);
        currentPath = currentPath.slice(0, depth);
        currentPath.push(cleanKey);
        
        if (cleanValue) {
          // Set value
          this.setNestedConfigValue(config, currentPath, this.parseYAMLValue(cleanValue));
        }
      }
    }
    
    return config;
  }

  /**
   * Parse YAML value to appropriate type
   */
  private parseYAMLValue(value: string): any {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (!isNaN(Number(value))) return Number(value);
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    return value;
  }

  /**
   * Set nested configuration value
   */
  private setNestedConfigValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in current)) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }
}