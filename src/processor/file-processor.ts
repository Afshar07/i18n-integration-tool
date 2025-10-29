import { TransformationResult, I18nIntegrationConfig, TextMatch } from '../types';
import { logger, FileOperations } from '../utils';
import { CodeTransformer } from './code-transformer';
import { ImportInjector } from './import-injector';
import { TemplateTransformer } from './template-transformer';

/**
 * File processor for transforming source files with i18n calls
 */
export class FileProcessor {
  private codeTransformer: CodeTransformer;
  private importInjector: ImportInjector;
  private templateTransformer: TemplateTransformer;

  constructor(private config: I18nIntegrationConfig) {
    this.codeTransformer = new CodeTransformer({
      preserveFormatting: true,
      useAlias: true
    });
    
    this.importInjector = new ImportInjector({
      useAlias: true,
      preserveFormatting: true
    });
    
    this.templateTransformer = new TemplateTransformer({
      preserveFormatting: true,
      useAlias: true
    });
  }

  /**
   * Process a single file by transforming its content with i18n calls
   */
  async processFile(
    filePath: string,
    matches: TextMatch[],
    keyMap: Map<string, string>
  ): Promise<TransformationResult> {
    try {
      logger.info(`Processing file: ${filePath}`);

      // Read the original file content
      const originalContent = await FileOperations.readFile(filePath);
      let transformedContent = originalContent;
      const addedImports: string[] = [];
      let allReplacements: any[] = [];

      // Determine file type
      const isVueFile = filePath.endsWith('.vue');
      const isJsTs = filePath.endsWith('.js') || filePath.endsWith('.ts') || 
                    filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

      if (isVueFile) {
        // Process Vue Single File Component
        const result = await this.processVueFile(originalContent, matches, keyMap);
        transformedContent = result.transformedContent;
        addedImports.push(...result.addedImports);
        allReplacements.push(...result.replacements);
      } else if (isJsTs) {
        // Process JavaScript/TypeScript file
        const result = await this.processJsFile(originalContent, matches, keyMap);
        transformedContent = result.transformedContent;
        addedImports.push(...result.addedImports);
        allReplacements.push(...result.replacements);
      } else {
        logger.warn(`Unsupported file type: ${filePath}`);
      }

      // Create backup if configured
      if (this.config.fileProcessing.createBackups) {
        await this.createBackup(filePath, originalContent);
      }

      // Write transformed content if not in dry run mode
      if (!this.config.fileProcessing.dryRun) {
        await FileOperations.writeFile(filePath, transformedContent);
        logger.info(`Successfully transformed: ${filePath}`);
      } else {
        logger.info(`Dry run - would transform: ${filePath}`);
      }

      return {
        filePath,
        originalContent,
        transformedContent,
        addedImports,
        replacements: allReplacements
      };

    } catch (error) {
      logger.error(`Error processing file ${filePath}:`, error as Error);
      throw error;
    }
  }

  /**
   * Process Vue Single File Component
   */
  private async processVueFile(
    content: string,
    matches: TextMatch[],
    keyMap: Map<string, string>
  ): Promise<{
    transformedContent: string;
    addedImports: string[];
    replacements: any[];
  }> {
    let transformedContent = content;
    const addedImports: string[] = [];
    const allReplacements: any[] = [];

    // Extract template section
    const templateContent = this.templateTransformer.extractTemplateFromVue(content);
    console.log('DEBUG: Template content extracted:', !!templateContent, templateContent?.length);
    if (templateContent) {
      const templateMatches = matches.filter(m => m.context === 'template');
      console.log('DEBUG: Template matches found:', templateMatches.length);
      if (templateMatches.length > 0) {
        console.log('DEBUG: Processing template matches:', templateMatches.map(m => m.text));
        const templateResult = await this.templateTransformer.transformTemplate(
          templateContent,
          templateMatches,
          keyMap
        );
        console.log('DEBUG: Template transformation result:', templateResult.hasChanges, templateResult.replacements.length);
        
        if (templateResult.hasChanges) {
          transformedContent = this.templateTransformer.replaceTemplateInVue(
            transformedContent,
            templateResult.transformedTemplate
          );
          allReplacements.push(...templateResult.replacements);
          console.log('DEBUG: Template content replaced');
        }
      }
    }

    // Extract and process script section
    const { script, hasSetup } = this.importInjector.extractScriptFromVue(content);
    if (script) {
      const scriptMatches = matches.filter(m => m.context === 'script');
      let processedScript = script;
      
      // Transform script content if there are matches
      if (scriptMatches.length > 0) {
        const codeResult = await this.codeTransformer.transformCode(
          script,
          scriptMatches,
          keyMap
        );
        
        if (codeResult.hasChanges) {
          processedScript = codeResult.transformedCode;
          allReplacements.push(...codeResult.replacements);
        }
      }

      // Inject imports if needed (check both template and script replacements)
      const needsI18n = allReplacements.length > 0;
      if (needsI18n) {
        const importResult = await this.importInjector.injectImports(processedScript, needsI18n);
        if (importResult.hasChanges) {
          processedScript = importResult.transformedCode;
          addedImports.push(...importResult.addedImports);
        }
      }

      // Replace script section in Vue file only if there were changes
      if (needsI18n || processedScript !== script) {
        transformedContent = this.importInjector.replaceScriptInVue(
          transformedContent,
          processedScript,
          hasSetup
        );
      }
    }

    return {
      transformedContent,
      addedImports,
      replacements: allReplacements
    };
  }

  /**
   * Process JavaScript/TypeScript file
   */
  private async processJsFile(
    content: string,
    matches: TextMatch[],
    keyMap: Map<string, string>
  ): Promise<{
    transformedContent: string;
    addedImports: string[];
    replacements: any[];
  }> {
    let transformedContent = content;
    const addedImports: string[] = [];
    const allReplacements: any[] = [];

    // Transform code
    const scriptMatches = matches.filter(m => m.context === 'script');
    if (scriptMatches.length > 0) {
      const codeResult = await this.codeTransformer.transformCode(
        content,
        scriptMatches,
        keyMap
      );
      
      if (codeResult.hasChanges) {
        transformedContent = codeResult.transformedCode;
        allReplacements.push(...codeResult.replacements);

        // Inject imports if needed
        const importResult = await this.importInjector.injectImports(transformedContent, true);
        if (importResult.hasChanges) {
          transformedContent = importResult.transformedCode;
          addedImports.push(...importResult.addedImports);
        }
      }
    }

    return {
      transformedContent,
      addedImports,
      replacements: allReplacements
    };
  }

  /**
   * Create backup of original file
   */
  private async createBackup(filePath: string, content: string): Promise<void> {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await FileOperations.writeFile(backupPath, content);
      logger.debug(`Created backup: ${backupPath}`);
    } catch (error) {
      logger.warn(`Failed to create backup for ${filePath}:`, error);
    }
  }

  /**
   * Transform files using generated keys (main entry point for CLI)
   */
  async transformFiles(generatedKeys: Array<{ key: string; originalText: string; filePath?: string }>): Promise<TransformationResult[]> {
    logger.info(`Transforming files using ${generatedKeys.length} generated keys`);

    // Group keys by file path
    const fileMatches = new Map<string, TextMatch[]>();
    const keyMap = new Map<string, string>();

    for (const genKey of generatedKeys) {
      keyMap.set(genKey.originalText, genKey.key);
      
      // If we have file path information, group by file
      if (genKey.filePath) {
        if (!fileMatches.has(genKey.filePath)) {
          fileMatches.set(genKey.filePath, []);
        }
        fileMatches.get(genKey.filePath)!.push({
          text: genKey.originalText,
          filePath: genKey.filePath,
          lineNumber: 0, // Would need to be provided by scanner
          columnNumber: 0,
          context: 'script' // Default context
        });
      }
    }

    // If no file paths provided, we need to scan for files containing these texts
    if (fileMatches.size === 0) {
      logger.warn('No file paths provided with generated keys, transformation may be incomplete');
      return [];
    }

    return this.processFiles(fileMatches, keyMap);
  }

  /**
   * Process multiple files in batches
   */
  async processFiles(
    fileMatches: Map<string, TextMatch[]>,
    keyMap: Map<string, string>
  ): Promise<TransformationResult[]> {
    const results: TransformationResult[] = [];
    const files = Array.from(fileMatches.keys());
    const batchSize = this.config.fileProcessing.batchSize || 10;

    logger.info(`Processing ${files.length} files in batches of ${batchSize}`);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(async (filePath) => {
        const matches = fileMatches.get(filePath) || [];
        return this.processFile(filePath, matches, keyMap);
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        logger.info(`Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`);
      } catch (error) {
        logger.error(`Error processing batch starting at index ${i}:`, error as Error);
        throw error;
      }
    }

    return results;
  }
}