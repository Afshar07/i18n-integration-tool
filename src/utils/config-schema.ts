import { I18nIntegrationConfig } from '../types';

/**
 * Configuration schema validation and type definitions
 */

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    default?: any;
    validate?: (value: any) => boolean | string;
    description?: string;
    options?: any[];
  };
}

/**
 * Complete configuration schema with validation rules
 */
export const CONFIG_SCHEMA: ConfigSchema = {
  'sourceDirectories': {
    type: 'array',
    required: true,
    default: ['components', 'pages', 'layouts', 'plugins', 'middleware', 'composables', 'store'],
    validate: (value: string[]) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'sourceDirectories must be a non-empty array';
      }
      return true;
    },
    description: 'Directories to scan for source files'
  },
  
  'excludePatterns': {
    type: 'array',
    required: false,
    default: ['node_modules/**', '.nuxt/**', '.output/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts', '**/*.d.ts'],
    description: 'Glob patterns for files/directories to exclude from scanning'
  },
  
  'locales.source': {
    type: 'string',
    required: true,
    default: 'fa',
    validate: (value: string) => {
      if (!value || value.length < 2) {
        return 'Source locale must be at least 2 characters';
      }
      return true;
    },
    description: 'Source locale code (e.g., "fa" for Persian)'
  },
  
  'locales.target': {
    type: 'string',
    required: true,
    default: 'en',
    validate: (value: string) => {
      if (!value || value.length < 2) {
        return 'Target locale must be at least 2 characters';
      }
      return true;
    },
    description: 'Target locale code (e.g., "en" for English)'
  },
  
  'keyGeneration.strategy': {
    type: 'string',
    required: true,
    default: 'semantic',
    options: ['semantic', 'hash', 'sequential'],
    validate: (value: string) => {
      const validStrategies = ['semantic', 'hash', 'sequential'];
      if (!validStrategies.includes(value)) {
        return `Strategy must be one of: ${validStrategies.join(', ')}`;
      }
      return true;
    },
    description: 'Key generation strategy'
  },
  
  'keyGeneration.maxLength': {
    type: 'number',
    required: true,
    default: 50,
    validate: (value: number) => {
      if (value < 10 || value > 200) {
        return 'maxLength must be between 10 and 200';
      }
      return true;
    },
    description: 'Maximum length for generated keys'
  },
  
  'keyGeneration.useContext': {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Whether to use context information in key generation'
  },
  
  'fileProcessing.createBackups': {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Whether to create backups before modifying files'
  },
  
  'fileProcessing.dryRun': {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Whether to perform a dry run without making changes'
  },
  
  'fileProcessing.batchSize': {
    type: 'number',
    required: false,
    default: 10,
    validate: (value: number) => {
      if (value < 1 || value > 100) {
        return 'batchSize must be between 1 and 100';
      }
      return true;
    },
    description: 'Number of files to process in each batch'
  },
  
  'translationFiles.directory': {
    type: 'string',
    required: true,
    default: 'assets/locales',
    validate: (value: string) => {
      if (!value || value.trim().length === 0) {
        return 'Translation files directory cannot be empty';
      }
      return true;
    },
    description: 'Directory where translation files are stored'
  },
  
  'translationFiles.format': {
    type: 'string',
    required: true,
    default: 'json',
    options: ['json', 'yaml'],
    validate: (value: string) => {
      const validFormats = ['json', 'yaml'];
      if (!validFormats.includes(value)) {
        return `Format must be one of: ${validFormats.join(', ')}`;
      }
      return true;
    },
    description: 'Format for translation files'
  }
};

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate entire configuration object
   */
  static validate(config: Partial<I18nIntegrationConfig>): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each schema field
    for (const [path, schema] of Object.entries(CONFIG_SCHEMA)) {
      const value = this.getNestedValue(config, path);
      
      // Check required fields
      if (schema.required && (value === undefined || value === null)) {
        errors.push(`Required field '${path}' is missing`);
        continue;
      }
      
      // Skip validation if value is undefined and not required
      if (value === undefined) {
        continue;
      }
      
      // Type validation
      if (!this.validateType(value, schema.type)) {
        errors.push(`Field '${path}' must be of type ${schema.type}`);
        continue;
      }
      
      // Custom validation
      if (schema.validate) {
        const result = schema.validate(value);
        if (result !== true) {
          errors.push(`Field '${path}': ${result}`);
        }
      }
      
      // Options validation
      if (schema.options && !schema.options.includes(value)) {
        errors.push(`Field '${path}' must be one of: ${schema.options.join(', ')}`);
      }
    }

    // Additional cross-field validations
    if (config.locales?.source === config.locales?.target) {
      warnings.push('Source and target locales are the same');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get nested object value by dot notation path
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Validate value type
   */
  private static validateType(value: any, expectedType: string): boolean {
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
   * Get default configuration based on schema
   */
  static getDefaultConfig(): I18nIntegrationConfig {
    const config: any = {};
    
    for (const [path, schema] of Object.entries(CONFIG_SCHEMA)) {
      if (schema.default !== undefined) {
        this.setNestedValue(config, path, schema.default);
      }
    }
    
    return config as I18nIntegrationConfig;
  }

  /**
   * Set nested object value by dot notation path
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  /**
   * Get configuration help text
   */
  static getHelpText(): string {
    const lines = [
      'Configuration Options:',
      '=====================',
      ''
    ];

    for (const [path, schema] of Object.entries(CONFIG_SCHEMA)) {
      lines.push(`${path}:`);
      lines.push(`  Type: ${schema.type}`);
      lines.push(`  Default: ${JSON.stringify(schema.default)}`);
      if (schema.description) {
        lines.push(`  Description: ${schema.description}`);
      }
      if (schema.options) {
        lines.push(`  Options: ${schema.options.join(', ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}