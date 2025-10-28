import { I18nIntegrationConfig } from '../types';

/**
 * Configuration templates for different project types and scenarios
 */

export interface ConfigTemplate {
  name: string;
  description: string;
  config: Partial<I18nIntegrationConfig>;
}

/**
 * Predefined configuration templates
 */
export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    name: 'nuxt-default',
    description: 'Default configuration for Nuxt.js projects',
    config: {
      sourceDirectories: [
        'components',
        'pages',
        'layouts',
        'plugins',
        'middleware',
        'composables',
        'store'
      ],
      excludePatterns: [
        'node_modules/**',
        '.nuxt/**',
        '.output/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts'
      ],
      locales: {
        source: 'fa',
        target: 'en'
      },
      keyGeneration: {
        strategy: 'semantic',
        maxLength: 50,
        useContext: true
      },
      fileProcessing: {
        createBackups: true,
        dryRun: false,
        batchSize: 10
      },
      translationFiles: {
        directory: 'assets/locales',
        format: 'json'
      }
    }
  },
  
  {
    name: 'vue-spa',
    description: 'Configuration for Vue.js Single Page Applications',
    config: {
      sourceDirectories: [
        'src/components',
        'src/views',
        'src/router',
        'src/store',
        'src/composables'
      ],
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts'
      ],
      locales: {
        source: 'fa',
        target: 'en'
      },
      keyGeneration: {
        strategy: 'semantic',
        maxLength: 60,
        useContext: true
      },
      fileProcessing: {
        createBackups: true,
        dryRun: false,
        batchSize: 15
      },
      translationFiles: {
        directory: 'src/locales',
        format: 'json'
      }
    }
  },
  
  {
    name: 'large-project',
    description: 'Configuration optimized for large projects with many files',
    config: {
      sourceDirectories: [
        'src',
        'components',
        'pages',
        'layouts',
        'modules'
      ],
      excludePatterns: [
        'node_modules/**',
        '.nuxt/**',
        '.output/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
        '**/*.stories.*'
      ],
      locales: {
        source: 'fa',
        target: 'en'
      },
      keyGeneration: {
        strategy: 'semantic',
        maxLength: 40,
        useContext: true
      },
      fileProcessing: {
        createBackups: true,
        dryRun: false,
        batchSize: 5 // Smaller batches for large projects
      },
      translationFiles: {
        directory: 'locales',
        format: 'json'
      }
    }
  },
  
  {
    name: 'development',
    description: 'Configuration for development with extensive logging and dry-run mode',
    config: {
      sourceDirectories: [
        'components',
        'pages',
        'layouts'
      ],
      excludePatterns: [
        'node_modules/**',
        '.nuxt/**',
        'dist/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      locales: {
        source: 'fa',
        target: 'en'
      },
      keyGeneration: {
        strategy: 'semantic',
        maxLength: 50,
        useContext: true
      },
      fileProcessing: {
        createBackups: true,
        dryRun: true, // Safe for development
        batchSize: 5
      },
      translationFiles: {
        directory: 'assets/locales',
        format: 'json'
      }
    }
  },
  
  {
    name: 'production',
    description: 'Configuration optimized for production deployment',
    config: {
      sourceDirectories: [
        'components',
        'pages',
        'layouts',
        'plugins',
        'middleware',
        'composables',
        'store'
      ],
      excludePatterns: [
        'node_modules/**',
        '.nuxt/**',
        '.output/**',
        'dist/**',
        'coverage/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
        '**/*.stories.*',
        '**/*.md'
      ],
      locales: {
        source: 'fa',
        target: 'en'
      },
      keyGeneration: {
        strategy: 'semantic',
        maxLength: 45,
        useContext: true
      },
      fileProcessing: {
        createBackups: true,
        dryRun: false,
        batchSize: 20 // Larger batches for efficiency
      },
      translationFiles: {
        directory: 'assets/locales',
        format: 'json'
      }
    }
  },
  
  {
    name: 'minimal',
    description: 'Minimal configuration for small projects',
    config: {
      sourceDirectories: [
        'components',
        'pages'
      ],
      excludePatterns: [
        'node_modules/**',
        'dist/**'
      ],
      locales: {
        source: 'fa',
        target: 'en'
      },
      keyGeneration: {
        strategy: 'hash',
        maxLength: 30,
        useContext: false
      },
      fileProcessing: {
        createBackups: false,
        dryRun: false,
        batchSize: 50
      },
      translationFiles: {
        directory: 'locales',
        format: 'json'
      }
    }
  }
];

/**
 * Configuration template manager
 */
export class ConfigTemplateManager {
  /**
   * Get all available templates
   */
  static getTemplates(): ConfigTemplate[] {
    return CONFIG_TEMPLATES;
  }

  /**
   * Get template by name
   */
  static getTemplate(name: string): ConfigTemplate | undefined {
    return CONFIG_TEMPLATES.find(template => template.name === name);
  }

  /**
   * Get template names
   */
  static getTemplateNames(): string[] {
    return CONFIG_TEMPLATES.map(template => template.name);
  }

  /**
   * Create configuration from template
   */
  static createFromTemplate(templateName: string, overrides?: Partial<I18nIntegrationConfig>): Partial<I18nIntegrationConfig> {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    if (overrides) {
      return this.mergeConfig(template.config, overrides);
    }

    return { ...template.config };
  }

  /**
   * Generate custom template based on project structure
   */
  static generateCustomTemplate(projectPath: string): Promise<Partial<I18nIntegrationConfig>> {
    // This would analyze the project structure and suggest optimal configuration
    // For now, return a basic template
    return Promise.resolve({
      sourceDirectories: ['src', 'components'],
      excludePatterns: ['node_modules/**', 'dist/**'],
      locales: { source: 'fa', target: 'en' },
      keyGeneration: { strategy: 'semantic', maxLength: 50, useContext: true },
      fileProcessing: { createBackups: true, dryRun: false, batchSize: 10 },
      translationFiles: { directory: 'locales', format: 'json' }
    });
  }

  /**
   * Validate template configuration
   */
  static validateTemplate(template: ConfigTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.description || template.description.trim().length === 0) {
      errors.push('Template description is required');
    }

    if (!template.config || typeof template.config !== 'object') {
      errors.push('Template config is required and must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Export template to JSON
   */
  static exportTemplate(template: ConfigTemplate): string {
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template from JSON
   */
  static importTemplate(json: string): ConfigTemplate {
    try {
      const template = JSON.parse(json) as ConfigTemplate;
      
      const validation = this.validateTemplate(template);
      if (!validation.isValid) {
        throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
      }

      return template;
    } catch (error) {
      throw new Error(`Failed to import template: ${error}`);
    }
  }

  /**
   * Deep merge configuration objects
   */
  private static mergeConfig(
    base: Partial<I18nIntegrationConfig>, 
    override: Partial<I18nIntegrationConfig>
  ): Partial<I18nIntegrationConfig> {
    const result = { ...base };

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

    return result;
  }

  /**
   * Get template suggestions based on project characteristics
   */
  static getTemplateSuggestions(characteristics: {
    hasNuxtConfig?: boolean;
    hasVueConfig?: boolean;
    projectSize?: 'small' | 'medium' | 'large';
    isDevelopment?: boolean;
  }): string[] {
    const suggestions: string[] = [];

    if (characteristics.hasNuxtConfig) {
      suggestions.push('nuxt-default');
    } else if (characteristics.hasVueConfig) {
      suggestions.push('vue-spa');
    }

    if (characteristics.projectSize === 'large') {
      suggestions.push('large-project');
    } else if (characteristics.projectSize === 'small') {
      suggestions.push('minimal');
    }

    if (characteristics.isDevelopment) {
      suggestions.push('development');
    } else {
      suggestions.push('production');
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }
}