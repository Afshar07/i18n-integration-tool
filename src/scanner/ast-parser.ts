/**
 * AST parser for JavaScript/TypeScript files
 * Extracts string literals containing Persian/Arabic text using Babel
 */

import { parse, ParserOptions } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TextPatternMatcher } from './text-patterns';
import { TextMatch } from '../types';

export interface ASTParseOptions {
  sourceType?: 'module' | 'script';
  allowImportExportEverywhere?: boolean;
  allowReturnOutsideFunction?: boolean;
  plugins?: string[];
}

export interface StringLiteralMatch extends TextMatch {
  nodeType: 'StringLiteral' | 'TemplateLiteral' | 'JSXText' | 'JSXAttribute';
  parentType?: string;
  isInFunction?: boolean;
  isInObject?: boolean;
  objectKey?: string;
}

/**
 * AST Parser for extracting Persian/Arabic text from JavaScript/TypeScript files
 */
export class ASTParser {
  private options: ASTParseOptions;

  constructor(options: ASTParseOptions = {}) {
    this.options = {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        'importMeta',
        'topLevelAwait',
        'optionalCatchBinding'
      ],
      ...options
    };
  }

  /**
   * Parse JavaScript/TypeScript content and extract Persian/Arabic strings
   */
  async parseContent(content: string, filePath: string): Promise<StringLiteralMatch[]> {
    try {
      const ast = parse(content, this.options as ParserOptions);
      const matches: StringLiteralMatch[] = [];

      traverse(ast, {
        // String literals: 'text', "text"
        StringLiteral: (path: NodePath<t.StringLiteral>) => {
          const value = path.node.value;
          if (TextPatternMatcher.containsPersianArabic(value) && TextPatternMatcher.isValidText(value)) {
            matches.push(this.createMatch(path, value, 'StringLiteral', filePath, content));
          }
        },

        // Template literals: `text ${variable} more text`
        TemplateLiteral: (path: NodePath<t.TemplateLiteral>) => {
          const quasis = path.node.quasis;
          
          for (let i = 0; i < quasis.length; i++) {
            const quasi = quasis[i];
            const value = quasi.value.raw || quasi.value.cooked || '';
            
            if (TextPatternMatcher.containsPersianArabic(value) && TextPatternMatcher.isValidText(value)) {
              matches.push(this.createMatch(path, value, 'TemplateLiteral', filePath, content));
            }
          }
        },

        // JSX Text nodes (for React/Vue JSX)
        JSXText: (path: NodePath<t.JSXText>) => {
          const value = path.node.value.trim();
          if (TextPatternMatcher.containsPersianArabic(value) && TextPatternMatcher.isValidText(value)) {
            matches.push(this.createMatch(path, value, 'JSXText', filePath, content));
          }
        },

        // JSX Attribute values
        JSXAttribute: (path: NodePath<t.JSXAttribute>) => {
          const value = path.node.value;
          if (t.isStringLiteral(value)) {
            const textValue = value.value;
            if (TextPatternMatcher.containsPersianArabic(textValue) && TextPatternMatcher.isValidText(textValue)) {
              matches.push(this.createMatch(path, textValue, 'JSXAttribute', filePath, content));
            }
          }
        }
      });

      return matches;
    } catch (error) {
      throw new Error(`Failed to parse AST for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a TextMatch object from AST node information
   */
  private createMatch(
    path: NodePath<any>,
    text: string,
    nodeType: StringLiteralMatch['nodeType'],
    filePath: string,
    content: string
  ): StringLiteralMatch {
    const node = path.node;
    const location = node.loc;
    
    // Calculate line and column numbers
    const lineNumber = location?.start.line || 1;
    const columnNumber = location?.start.column || 0;

    // Determine context information
    const parentType = path.parent?.type;
    const isInFunction = this.isInsideFunction(path);
    const isInObject = this.isInsideObject(path);
    const objectKey = this.getObjectKey(path);

    return {
      text: TextPatternMatcher.cleanExtractedText(text),
      filePath,
      lineNumber,
      columnNumber,
      context: 'script',
      nodeType,
      parentType,
      isInFunction,
      isInObject,
      objectKey
    };
  }

  /**
   * Check if the node is inside a function
   */
  private isInsideFunction(path: NodePath<any>): boolean {
    let currentPath = path.parentPath;
    while (currentPath) {
      const node = currentPath.node;
      if (
        t.isFunctionDeclaration(node) ||
        t.isFunctionExpression(node) ||
        t.isArrowFunctionExpression(node) ||
        t.isMethod(node)
      ) {
        return true;
      }
      currentPath = currentPath.parentPath;
    }
    return false;
  }

  /**
   * Check if the node is inside an object
   */
  private isInsideObject(path: NodePath<any>): boolean {
    return t.isObjectProperty(path.parent) || t.isObjectMethod(path.parent);
  }

  /**
   * Get the object key if the node is inside an object property
   */
  private getObjectKey(path: NodePath<any>): string | undefined {
    if (t.isObjectProperty(path.parent)) {
      const key = path.parent.key;
      if (t.isIdentifier(key)) {
        return key.name;
      } else if (t.isStringLiteral(key)) {
        return key.value;
      }
    }
    return undefined;
  }

  /**
   * Parse multiple files and return combined results
   */
  async parseFiles(files: Array<{ path: string; content: string }>): Promise<StringLiteralMatch[]> {
    const allMatches: StringLiteralMatch[] = [];

    for (const file of files) {
      try {
        const matches = await this.parseContent(file.content, file.path);
        allMatches.push(...matches);
      } catch (error) {
        console.warn(`Warning: Could not parse ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return allMatches;
  }

  /**
   * Get parser configuration for different file types
   */
  static getParserOptions(filePath: string): ASTParseOptions {
    const isTypeScript = /\.tsx?$/.test(filePath);
    const isJSX = /\.(jsx|tsx)$/.test(filePath);

    const plugins = [
      'decorators-legacy',
      'classProperties',
      'objectRestSpread',
      'asyncGenerators',
      'functionBind',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'dynamicImport',
      'nullishCoalescingOperator',
      'optionalChaining',
      'importMeta',
      'topLevelAwait',
      'optionalCatchBinding'
    ];

    if (isTypeScript) {
      plugins.push('typescript');
    }

    if (isJSX) {
      plugins.push('jsx');
    }

    return {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins
    };
  }

  /**
   * Check if a file should be parsed by this parser
   */
  static canParseFile(filePath: string): boolean {
    return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filePath);
  }
}

/**
 * Utility functions for AST parsing
 */
export class ASTParserUtils {
  /**
   * Extract all string concatenations that might contain Persian/Arabic text
   */
  static extractConcatenatedStrings(content: string, filePath: string): StringLiteralMatch[] {
    const matches: StringLiteralMatch[] = [];
    
    try {
      const ast = parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        plugins: ['typescript', 'jsx']
      } as ParserOptions);

      traverse(ast, {
        BinaryExpression: (path: NodePath<t.BinaryExpression>) => {
          if (path.node.operator === '+') {
            const concatenatedText = this.extractConcatenationText(path.node);
            if (concatenatedText && TextPatternMatcher.containsPersianArabic(concatenatedText)) {
              const location = path.node.loc;
              matches.push({
                text: TextPatternMatcher.cleanExtractedText(concatenatedText),
                filePath,
                lineNumber: location?.start.line || 1,
                columnNumber: location?.start.column || 0,
                context: 'script',
                nodeType: 'StringLiteral',
                parentType: path.parent?.type
              });
            }
          }
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not extract concatenated strings from ${filePath}`);
    }

    return matches;
  }

  /**
   * Extract text from string concatenation expressions
   */
  private static extractConcatenationText(node: t.BinaryExpression): string | null {
    const leftText = this.getStringValue(node.left);
    const rightText = this.getStringValue(node.right);

    if (leftText !== null && rightText !== null) {
      return leftText + rightText;
    }

    return null;
  }

  /**
   * Get string value from various node types
   */
  private static getStringValue(node: t.Node): string | null {
    if (t.isStringLiteral(node)) {
      return node.value;
    }
    
    if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
      return node.quasis[0]?.value.cooked || null;
    }

    if (t.isBinaryExpression(node) && node.operator === '+') {
      return this.extractConcatenationText(node);
    }

    return null;
  }
}

export default ASTParser;