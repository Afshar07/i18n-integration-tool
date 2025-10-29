import * as t from '@babel/types';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { logger } from '../utils';

export interface ImportInjectionResult {
  transformedCode: string;
  addedImports: string[];
  hasChanges: boolean;
}

export interface ImportInjectionOptions {
  useAlias: boolean; // Use {t: $t} destructuring
  preserveFormatting: boolean;
}

/**
 * Handles injection of useI18n imports in Vue components and JavaScript/TypeScript files
 */
export class ImportInjector {
  private options: ImportInjectionOptions;

  constructor(options: Partial<ImportInjectionOptions> = {}) {
    this.options = {
      useAlias: true,
      preserveFormatting: true,
      ...options
    };
  }

  /**
   * Inject useI18n import and composable usage if needed
   */
  async injectImports(code: string, needsI18n: boolean): Promise<ImportInjectionResult> {
    try {
      if (!needsI18n) {
        return {
          transformedCode: code,
          addedImports: [],
          hasChanges: false
        };
      }

      const addedImports: string[] = [];
      let hasChanges = false;

      // Parse the code into AST
      const { parse } = await import('@babel/parser');
      
      // Check if the code contains TypeScript syntax
      const isTypeScript = /\b(interface|type|enum|namespace|declare|abstract|implements|private|protected|public|readonly)\b/.test(code);
      
      let ast;
      try {
        if (isTypeScript) {
          // For TypeScript files, use TypeScript parser configuration
          ast = parse(code, {
            sourceType: 'module',
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            plugins: [
              'typescript',
              'jsx',
              'decorators-legacy',
              'classProperties',
              'objectRestSpread',
              'optionalChaining',
              'nullishCoalescingOperator'
            ]
          });
        } else {
          // For JavaScript files, use JavaScript parser configuration
          ast = parse(code, {
            sourceType: 'module',
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            plugins: [
              'jsx',
              'decorators-legacy',
              'classProperties',
              'objectRestSpread',
              'optionalChaining',
              'nullishCoalescingOperator'
            ]
          });
        }
      } catch (error) {
        // If parsing fails, try with a more permissive configuration
        logger.warn(`Initial parsing failed, trying with permissive configuration: ${error}`);
        try {
          ast = parse(code, {
            sourceType: 'unambiguous',
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            allowUndeclaredExports: true,
            strictMode: false,
            plugins: [
              'typescript',
              'jsx',
              'decorators-legacy',
              'classProperties',
              'objectRestSpread',
              'optionalChaining',
              'nullishCoalescingOperator'
            ]
          });
        } catch (fallbackError) {
          // If all parsing attempts fail, return unchanged
          logger.warn(`Skipping import injection due to parsing error: ${fallbackError}`);
          return {
            transformedCode: code,
            addedImports: [],
            hasChanges: false
          };
        }
      }

      if (!ast) {
        throw new Error('Failed to parse code');
      }

      // Check if useI18n is already imported
      let hasUseI18nImport = false;
      let hasI18nDestructuring = false;
      let setupFunction: any = null;

      traverse(ast, {
        ImportDeclaration: (path) => {
          // Check for existing useI18n import from vue-i18n or @nuxtjs/i18n
          if (path.node.source.value === 'vue-i18n' || 
              path.node.source.value === '@nuxtjs/i18n' ||
              path.node.source.value === '#imports') {
            
            const specifiers = path.node.specifiers;
            for (const spec of specifiers) {
              if (t.isImportSpecifier(spec) && 
                  t.isIdentifier(spec.imported) && 
                  spec.imported.name === 'useI18n') {
                hasUseI18nImport = true;
                logger.debug('Found existing useI18n import');
                break;
              }
            }
          }
        },

        // Look for setup function in Vue components
        ObjectMethod: (path) => {
          if (t.isIdentifier(path.node.key) && path.node.key.name === 'setup') {
            setupFunction = path;
          }
        },

        // Look for setup function as arrow function property
        ObjectProperty: (path) => {
          if (t.isIdentifier(path.node.key) && path.node.key.name === 'setup' &&
              (t.isArrowFunctionExpression(path.node.value) || t.isFunctionExpression(path.node.value))) {
            setupFunction = path;
          }
        },

        // Check for existing i18n destructuring
        VariableDeclarator: (path) => {
          if (t.isObjectPattern(path.node.id)) {
            const properties = path.node.id.properties;
            for (const prop of properties) {
              if (t.isObjectProperty(prop) && 
                  t.isIdentifier(prop.key) && 
                  prop.key.name === 't' &&
                  t.isCallExpression(path.node.init) &&
                  t.isIdentifier(path.node.init.callee) &&
                  path.node.init.callee.name === 'useI18n') {
                hasI18nDestructuring = true;
                logger.debug('Found existing i18n destructuring');
                break;
              }
            }
          }
        }
      });

      // Add useI18n import if not present
      if (!hasUseI18nImport) {
        const importDeclaration = t.importDeclaration(
          [t.importSpecifier(t.identifier('useI18n'), t.identifier('useI18n'))],
          t.stringLiteral('#imports')
        );

        // Add import at the top of the file
        if (ast && t.isFile(ast) && ast.program && ast.program.body) {
          ast.program.body.unshift(importDeclaration);
        }
        addedImports.push('useI18n from #imports');
        hasChanges = true;
        logger.debug('Added useI18n import');
      }

      // Add i18n destructuring if not present and we have a setup function
      if (!hasI18nDestructuring && setupFunction) {
        this.addI18nDestructuring(setupFunction);
        addedImports.push('const {t: $t} = useI18n()');
        hasChanges = true;
        logger.debug('Added i18n destructuring');
      }

      // Generate the transformed code
      const result = generate(ast, {
        retainLines: this.options.preserveFormatting,
        compact: false,
        comments: true
      });

      return {
        transformedCode: result.code,
        addedImports,
        hasChanges
      };

    } catch (error) {
      logger.error('Error injecting imports:', error as Error);
      throw new Error(`Import injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add i18n destructuring to setup function
   */
  private addI18nDestructuring(setupFunction: any): void {
    let functionBody: t.BlockStatement;

    if (t.isObjectMethod(setupFunction.node)) {
      functionBody = setupFunction.node.body;
    } else if (t.isObjectProperty(setupFunction.node)) {
      const func = setupFunction.node.value;
      if (t.isArrowFunctionExpression(func) && t.isBlockStatement(func.body)) {
        functionBody = func.body;
      } else if (t.isFunctionExpression(func)) {
        functionBody = func.body;
      } else {
        logger.warn('Cannot add i18n destructuring to arrow function with expression body');
        return;
      }
    } else {
      logger.warn('Unknown setup function type');
      return;
    }

    // Create the destructuring statement
    const destructuringStatement = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.objectPattern([
          t.objectProperty(
            t.identifier('t'),
            t.identifier(this.options.useAlias ? '$t' : 't')
          )
        ]),
        t.callExpression(t.identifier('useI18n'), [])
      )
    ]);

    // Add at the beginning of the function body
    functionBody.body.unshift(destructuringStatement);
  }

  /**
   * Check if code is a Vue Single File Component
   */
  isVueComponent(code: string): boolean {
    return code.includes('<template>') || code.includes('<script>') || code.includes('<style>');
  }

  /**
   * Extract script section from Vue SFC
   */
  extractScriptFromVue(vueCode: string): { script: string; hasSetup: boolean } {
    const scriptMatch = vueCode.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    const setupMatch = vueCode.match(/<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/);
    
    if (setupMatch) {
      return {
        script: setupMatch[1].trim(),
        hasSetup: true
      };
    } else if (scriptMatch) {
      return {
        script: scriptMatch[1].trim(),
        hasSetup: false
      };
    }
    
    return {
      script: '',
      hasSetup: false
    };
  }

  /**
   * Replace script section in Vue SFC
   */
  replaceScriptInVue(vueCode: string, newScript: string, hasSetup: boolean): string {
    if (hasSetup) {
      return vueCode.replace(
        /<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/,
        `<script setup lang="ts">\n${newScript}\n</script>`
      );
    } else {
      return vueCode.replace(
        /<script[^>]*>([\s\S]*?)<\/script>/,
        `<script lang="ts">\n${newScript}\n</script>`
      );
    }
  }
}