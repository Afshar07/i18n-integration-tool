import * as babel from '@babel/core';
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { TextMatch, TextReplacement } from '../types';
import { logger } from '../utils';

export interface CodeTransformationOptions {
  preserveFormatting: boolean;
  useAlias: boolean; // Use $t instead of t
}

export interface CodeTransformationResult {
  transformedCode: string;
  replacements: TextReplacement[];
  hasChanges: boolean;
}

/**
 * Transforms JavaScript/TypeScript code by replacing hardcoded Persian/Arabic strings with $t() calls
 */
export class CodeTransformer {
  private options: CodeTransformationOptions;

  constructor(options: Partial<CodeTransformationOptions> = {}) {
    this.options = {
      preserveFormatting: true,
      useAlias: true,
      ...options
    };
  }

  /**
   * Transform code by replacing matched text strings with i18n function calls
   */
  async transformCode(
    code: string,
    matches: TextMatch[],
    keyMap: Map<string, string>
  ): Promise<CodeTransformationResult> {
    try {
      const replacements: TextReplacement[] = [];
      let hasChanges = false;

      // Parse the code into AST
      const ast = babel.parse(code, {
        sourceType: 'module',
        plugins: [
          ['typescript', { isTSX: false }],
          'jsx',
          ['decorators', { legacy: true }],
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });

      if (!ast) {
        throw new Error('Failed to parse code');
      }

      // Create a map of text to replacement key for quick lookup
      const textToKeyMap = new Map<string, string>();
      matches.forEach(match => {
        const key = keyMap.get(match.text);
        if (key) {
          textToKeyMap.set(match.text, key);
        }
      });

      // Transform the AST
      traverse(ast, {
        StringLiteral: (path) => {
          const value = path.node.value;
          const replacementKey = textToKeyMap.get(value);
          
          if (replacementKey) {
            // Create $t() call expression
            const functionName = this.options.useAlias ? '$t' : 't';
            const callExpression = t.callExpression(
              t.identifier(functionName),
              [t.stringLiteral(replacementKey)]
            );

            // Replace the string literal with the call expression
            path.replaceWith(callExpression);
            
            // Record the replacement
            const loc = path.node.loc;
            replacements.push({
              originalText: value,
              replacementKey,
              position: {
                line: loc?.start.line || 0,
                column: loc?.start.column || 0
              }
            });
            
            hasChanges = true;
            logger.debug(`Replaced "${value}" with ${functionName}("${replacementKey}")`);
          }
        },

        TemplateLiteral: (path) => {
          // Handle template literals that contain only Persian/Arabic text
          const node = path.node;
          
          // Only transform if it's a simple template literal with no expressions
          if (node.expressions.length === 0 && node.quasis.length === 1) {
            const value = node.quasis[0].value.cooked || node.quasis[0].value.raw;
            const replacementKey = textToKeyMap.get(value);
            
            if (replacementKey) {
              const functionName = this.options.useAlias ? '$t' : 't';
              const callExpression = t.callExpression(
                t.identifier(functionName),
                [t.stringLiteral(replacementKey)]
              );

              path.replaceWith(callExpression);
              
              const loc = path.node.loc;
              replacements.push({
                originalText: value,
                replacementKey,
                position: {
                  line: loc?.start.line || 0,
                  column: loc?.start.column || 0
                }
              });
              
              hasChanges = true;
              logger.debug(`Replaced template literal "${value}" with ${functionName}("${replacementKey}")`);
            }
          }
        }
      });

      // Generate the transformed code
      const result = generate(ast, {
        retainLines: this.options.preserveFormatting,
        compact: false,
        comments: true
      });

      return {
        transformedCode: result.code,
        replacements,
        hasChanges
      };

    } catch (error) {
      logger.error('Error transforming code:', error as Error);
      throw new Error(`Code transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform object properties that contain Persian/Arabic text
   */
  private transformObjectProperty(
    path: any,
    textToKeyMap: Map<string, string>,
    replacements: TextReplacement[]
  ): boolean {
    let hasChanges = false;

    if (t.isObjectProperty(path.node) && t.isStringLiteral(path.node.value)) {
      const value = path.node.value.value;
      const replacementKey = textToKeyMap.get(value);
      
      if (replacementKey) {
        const functionName = this.options.useAlias ? '$t' : 't';
        const callExpression = t.callExpression(
          t.identifier(functionName),
          [t.stringLiteral(replacementKey)]
        );

        path.node.value = callExpression;
        
        const loc = path.node.loc;
        replacements.push({
          originalText: value,
          replacementKey,
          position: {
            line: loc?.start.line || 0,
            column: loc?.start.column || 0
          }
        });
        
        hasChanges = true;
        logger.debug(`Replaced object property "${value}" with ${functionName}("${replacementKey}")`);
      }
    }

    return hasChanges;
  }

  /**
   * Check if a string contains Persian or Arabic characters
   */
  private containsPersianArabic(text: string): boolean {
    // Persian and Arabic Unicode ranges
    const persianArabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return persianArabicRegex.test(text);
  }
}