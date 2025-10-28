import { ValidationResult, I18nIntegrationConfig } from '../types';
import { logger, FileOperations } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Nuxt.js integration validation options
 */
export interface NuxtValidationOptions {
  testLocaleSwitching?: boolean;
  testFallbackMechanisms?: boolean;
  testHotReloading?: boolean;
  testTimeout?: number;
  nuxtConfigPath?: string;
  translationFilesPath?: string;
}

/**
 * Nuxt.js integration test result
 */
export interface NuxtIntegrationResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
  duration: number;
}

/**
 * Comprehensive Nuxt.js integration validation result
 */
export interface NuxtValidationResult extends ValidationResult {
  testResults: NuxtIntegrationResult[];
  nuxtConfigValid: boolean;
  i18nModuleConfigured: boolean;
  translationFilesAccessible: boolean;
  devServerStarted: boolean;
}

/**
 * Nuxt.js integration validator for i18n system
 */
export class NuxtIntegrationValidator {
  private devProcess: ChildProcess | null = null;
  private devServerUrl = 'http://localhost:3000';

  constructor(
    private config: I18nIntegrationConfig,
    private projectRoot: string = process.cwd()
  ) {}

  /**
   * Validate complete Nuxt.js i18n integration
   */
  async validateNuxtIntegration(options: NuxtValidationOptions = {}): Promise<NuxtValidationResult> {
    logger.info('🔍 Starting Nuxt.js i18n integration validation...');

    const {
      testLocaleSwitching = true,
      testFallbackMechanisms = true,
      testHotReloading = true,
      testTimeout = 30000,
      nuxtConfigPath = 'nuxt.config.ts',
      translationFilesPath = 'assets/locales'
    } = options;

    const testResults: NuxtIntegrationResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    let nuxtConfigValid = false;
    let i18nModuleConfigured = false;
    let translationFilesAccessible = false;
    let devServerStarted = false;

    try {
      // 1. Validate Nuxt configuration
      logger.info('📋 Validating Nuxt configuration...');
      const configResult = await this.validateNuxtConfig(nuxtConfigPath);
      testResults.push(configResult);
      nuxtConfigValid = configResult.passed;
      
      if (configResult.passed && configResult.details?.hasI18nModule) {
        i18nModuleConfigured = true;
      }

      // 2. Validate translation files accessibility
      logger.info('📁 Validating translation files...');
      const filesResult = await this.validateTranslationFiles(translationFilesPath);
      testResults.push(filesResult);
      translationFilesAccessible = filesResult.passed;

      // 3. Start development server for runtime tests
      if (nuxtConfigValid && i18nModuleConfigured) {
        logger.info('🚀 Starting Nuxt development server...');
        const serverResult = await this.startDevServer(testTimeout);
        testResults.push(serverResult);
        devServerStarted = serverResult.passed;

        if (devServerStarted) {
          // 4. Test locale switching
          if (testLocaleSwitching) {
            logger.info('🌐 Testing locale switching...');
            const localeSwitchResult = await this.testLocaleSwitching(testTimeout);
            testResults.push(localeSwitchResult);
          }

          // 5. Test fallback mechanisms
          if (testFallbackMechanisms) {
            logger.info('🔄 Testing fallback mechanisms...');
            const fallbackResult = await this.testFallbackMechanisms(testTimeout);
            testResults.push(fallbackResult);
          }

          // 6. Test hot-reloading
          if (testHotReloading) {
            logger.info('🔥 Testing hot-reloading...');
            const hotReloadResult = await this.testHotReloading(testTimeout, translationFilesPath);
            testResults.push(hotReloadResult);
          }

          // Stop development server
          await this.stopDevServer();
        }
      }

      // Analyze results
      const failedTests = testResults.filter(result => !result.passed);
      const isValid = failedTests.length === 0;

      // Generate errors and suggestions
      failedTests.forEach(test => {
        errors.push(`${test.testName}: ${test.error || 'Test failed'}`);
      });

      if (!nuxtConfigValid) {
        suggestions.push('Fix Nuxt configuration issues before proceeding with i18n integration');
      }

      if (!i18nModuleConfigured) {
        suggestions.push('Ensure @nuxtjs/i18n module is properly configured in nuxt.config.ts');
      }

      if (!translationFilesAccessible) {
        suggestions.push('Verify translation files exist and are accessible in the configured directory');
      }

      if (!devServerStarted) {
        suggestions.push('Development server failed to start. Check for configuration errors or port conflicts');
      }

      logger.info(`Nuxt.js integration validation completed: ${isValid ? '✅ PASSED' : '❌ FAILED'} (${failedTests.length}/${testResults.length} tests failed)`);

      return {
        isValid,
        errors,
        warnings,
        suggestions,
        testResults,
        nuxtConfigValid,
        i18nModuleConfigured,
        translationFilesAccessible,
        devServerStarted
      };

    } catch (error) {
      logger.error('Nuxt.js integration validation failed:', error as Error);
      
      // Ensure dev server is stopped on error
      await this.stopDevServer();

      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings,
        suggestions,
        testResults,
        nuxtConfigValid,
        i18nModuleConfigured,
        translationFilesAccessible,
        devServerStarted
      };
    }
  }

  /**
   * Validate Nuxt configuration for i18n setup
   */
  private async validateNuxtConfig(configPath: string): Promise<NuxtIntegrationResult> {
    const startTime = Date.now();
    
    try {
      const fullConfigPath = path.join(this.projectRoot, configPath);
      const configContent = await FileOperations.readFile(fullConfigPath);

      // Check for @nuxtjs/i18n module
      const hasI18nModule = /['"]@nuxtjs\/i18n['"]/.test(configContent);
      
      // Check for i18n configuration
      const hasI18nConfig = /i18n\s*:\s*{/.test(configContent);
      
      // Check for locales configuration
      const hasLocalesConfig = /locales\s*:\s*\[/.test(configContent);
      
      // Check for default locale
      const hasDefaultLocale = /defaultLocale\s*:/.test(configContent);

      // Check for lazy loading
      const hasLazyLoading = /lazy\s*:\s*true/.test(configContent);

      // Check for language directory
      const hasLangDir = /langDir\s*:/.test(configContent);

      const configDetails = {
        hasI18nModule,
        hasI18nConfig,
        hasLocalesConfig,
        hasDefaultLocale,
        hasLazyLoading,
        hasLangDir
      };

      const passed = hasI18nModule && hasI18nConfig && hasLocalesConfig && hasDefaultLocale;

      return {
        testName: 'Nuxt Configuration Validation',
        passed,
        error: passed ? undefined : 'Missing required i18n configuration in nuxt.config.ts',
        details: configDetails,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        testName: 'Nuxt Configuration Validation',
        passed: false,
        error: `Failed to read Nuxt config: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate translation files accessibility
   */
  private async validateTranslationFiles(translationPath: string): Promise<NuxtIntegrationResult> {
    const startTime = Date.now();
    
    try {
      const fullTranslationPath = path.join(this.projectRoot, translationPath);
      
      // Check if translation directory exists
      const dirExists = await fs.access(fullTranslationPath).then(() => true).catch(() => false);
      
      if (!dirExists) {
        return {
          testName: 'Translation Files Validation',
          passed: false,
          error: `Translation directory not found: ${translationPath}`,
          duration: Date.now() - startTime
        };
      }

      // Check for required locale files
      const requiredLocales = [this.config.locales.source, this.config.locales.target];
      const missingFiles: string[] = [];
      const validFiles: string[] = [];

      for (const locale of requiredLocales) {
        const filePath = path.join(fullTranslationPath, `${locale}.json`);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          JSON.parse(content); // Validate JSON syntax
          validFiles.push(`${locale}.json`);
        } catch (error) {
          missingFiles.push(`${locale}.json (${error})`);
        }
      }

      const passed = missingFiles.length === 0;

      return {
        testName: 'Translation Files Validation',
        passed,
        error: passed ? undefined : `Missing or invalid translation files: ${missingFiles.join(', ')}`,
        details: { validFiles, missingFiles },
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        testName: 'Translation Files Validation',
        passed: false,
        error: `Failed to validate translation files: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Start Nuxt development server
   */
  private async startDevServer(timeout: number): Promise<NuxtIntegrationResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      try {
        // Start Nuxt dev server
        this.devProcess = spawn('npm', ['run', 'dev'], {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });

        let serverStarted = false;
        let errorOutput = '';

        // Set timeout
        const timeoutId = setTimeout(() => {
          if (!serverStarted) {
            this.stopDevServer();
            resolve({
              testName: 'Development Server Start',
              passed: false,
              error: `Server failed to start within ${timeout}ms`,
              duration: Date.now() - startTime
            });
          }
        }, timeout);

        // Listen for server ready
        this.devProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          
          // Look for server ready indicators
          if (output.includes('Local:') || output.includes('localhost:3000') || output.includes('ready in')) {
            if (!serverStarted) {
              serverStarted = true;
              clearTimeout(timeoutId);
              resolve({
                testName: 'Development Server Start',
                passed: true,
                details: { serverUrl: this.devServerUrl },
                duration: Date.now() - startTime
              });
            }
          }
        });

        // Listen for errors
        this.devProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        this.devProcess.on('error', (error) => {
          if (!serverStarted) {
            clearTimeout(timeoutId);
            resolve({
              testName: 'Development Server Start',
              passed: false,
              error: `Failed to start server: ${error.message}`,
              duration: Date.now() - startTime
            });
          }
        });

        this.devProcess.on('exit', (code) => {
          if (!serverStarted && code !== 0) {
            clearTimeout(timeoutId);
            resolve({
              testName: 'Development Server Start',
              passed: false,
              error: `Server exited with code ${code}: ${errorOutput}`,
              duration: Date.now() - startTime
            });
          }
        });

      } catch (error) {
        resolve({
          testName: 'Development Server Start',
          passed: false,
          error: `Failed to start development server: ${error}`,
          duration: Date.now() - startTime
        });
      }
    });
  }

  /**
   * Stop development server
   */
  private async stopDevServer(): Promise<void> {
    if (this.devProcess) {
      this.devProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (this.devProcess) {
          this.devProcess.on('exit', () => resolve());
          
          // Force kill after 5 seconds
          setTimeout(() => {
            if (this.devProcess) {
              this.devProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });
      
      this.devProcess = null;
    }
  }

  /**
   * Test locale switching functionality
   */
  private async testLocaleSwitching(timeout: number): Promise<NuxtIntegrationResult> {
    const startTime = Date.now();
    
    try {
      // Wait for server to be fully ready
      await this.waitForServer(5000);

      // Test basic page load
      const response = await this.makeHttpRequest(this.devServerUrl, timeout);
      
      if (!response.success) {
        return {
          testName: 'Locale Switching Test',
          passed: false,
          error: `Failed to load page: ${response.error}`,
          duration: Date.now() - startTime
        };
      }

      // Check if page contains i18n functionality
      const pageContent = response.data || '';
      const hasI18nSetup = pageContent.includes('useI18n') || 
                          pageContent.includes('$t(') || 
                          pageContent.includes('nuxt-i18n');

      // Test different locale URLs (if using prefix strategy)
      const localeTests = [];
      const locales = [this.config.locales.source, this.config.locales.target];
      
      for (const locale of locales) {
        try {
          // Test with locale parameter (common Nuxt i18n patterns)
          const localeUrl = `${this.devServerUrl}?locale=${locale}`;
          const localeResponse = await this.makeHttpRequest(localeUrl, timeout / 2);
          
          localeTests.push({
            locale,
            success: localeResponse.success,
            error: localeResponse.error
          });
        } catch (error) {
          localeTests.push({
            locale,
            success: false,
            error: `Locale test failed: ${error}`
          });
        }
      }

      const allLocaleTestsPassed = localeTests.every(test => test.success);
      const passed = hasI18nSetup && allLocaleTestsPassed;

      return {
        testName: 'Locale Switching Test',
        passed,
        error: passed ? undefined : 'Locale switching functionality not working properly',
        details: {
          hasI18nSetup,
          localeTests,
          pageLoadSuccess: response.success
        },
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        testName: 'Locale Switching Test',
        passed: false,
        error: `Locale switching test failed: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test fallback mechanisms
   */
  private async testFallbackMechanisms(timeout: number): Promise<NuxtIntegrationResult> {
    const startTime = Date.now();
    
    try {
      // Create a temporary translation key that only exists in one locale
      const testKey = `test_fallback_${Date.now()}`;
      const sourceTranslationPath = path.join(this.projectRoot, 'assets/locales', `${this.config.locales.source}.json`);
      const targetTranslationPath = path.join(this.projectRoot, 'assets/locales', `${this.config.locales.target}.json`);

      // Read current translations
      const sourceTranslations = JSON.parse(await fs.readFile(sourceTranslationPath, 'utf-8'));
      const targetTranslations = JSON.parse(await fs.readFile(targetTranslationPath, 'utf-8'));

      // Add test key only to source locale
      sourceTranslations[testKey] = 'Test fallback value';
      
      // Write back translations
      await fs.writeFile(sourceTranslationPath, JSON.stringify(sourceTranslations, null, 2));

      // Wait for hot-reload to pick up changes
      await this.delay(2000);

      // Test page load to see if fallback works
      const response = await this.makeHttpRequest(this.devServerUrl, timeout);
      
      // Clean up test key
      delete sourceTranslations[testKey];
      await fs.writeFile(sourceTranslationPath, JSON.stringify(sourceTranslations, null, 2));

      const passed = response.success;

      return {
        testName: 'Fallback Mechanisms Test',
        passed,
        error: passed ? undefined : 'Fallback mechanism test failed',
        details: {
          testKey,
          pageLoadSuccess: response.success
        },
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        testName: 'Fallback Mechanisms Test',
        passed: false,
        error: `Fallback test failed: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test hot-reloading functionality
   */
  private async testHotReloading(timeout: number, translationPath: string): Promise<NuxtIntegrationResult> {
    const startTime = Date.now();
    
    try {
      const testKey = `test_hot_reload_${Date.now()}`;
      const testValue = 'Hot reload test value';
      
      const sourceTranslationPath = path.join(this.projectRoot, translationPath, `${this.config.locales.source}.json`);
      
      // Read current translations
      const originalTranslations = JSON.parse(await fs.readFile(sourceTranslationPath, 'utf-8'));
      
      // Add test key
      const updatedTranslations = { ...originalTranslations, [testKey]: testValue };
      await fs.writeFile(sourceTranslationPath, JSON.stringify(updatedTranslations, null, 2));

      // Wait for hot-reload
      await this.delay(3000);

      // Test if server is still responsive
      const response = await this.makeHttpRequest(this.devServerUrl, timeout);
      
      // Clean up test key
      await fs.writeFile(sourceTranslationPath, JSON.stringify(originalTranslations, null, 2));

      const passed = response.success;

      return {
        testName: 'Hot-Reloading Test',
        passed,
        error: passed ? undefined : 'Hot-reloading functionality not working',
        details: {
          testKey,
          serverResponsive: response.success
        },
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        testName: 'Hot-Reloading Test',
        passed: false,
        error: `Hot-reloading test failed: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Make HTTP request to test server
   */
  private async makeHttpRequest(url: string, timeout: number): Promise<{ success: boolean; data?: string; error?: string }> {
    return new Promise((resolve) => {
      const http = require('http');
      const urlObj = new URL(url);
      
      const request = http.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout
      }, (response: any) => {
        let data = '';
        
        response.on('data', (chunk: any) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            success: response.statusCode >= 200 && response.statusCode < 400,
            data,
            error: response.statusCode >= 400 ? `HTTP ${response.statusCode}` : undefined
          });
        });
      });

      request.on('error', (error: any) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      request.end();
    });
  }

  /**
   * Wait for server to be ready
   */
  private async waitForServer(timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.makeHttpRequest(this.devServerUrl, 2000);
        if (response.success) {
          return;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await this.delay(1000);
    }
    
    throw new Error('Server not ready within timeout');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}