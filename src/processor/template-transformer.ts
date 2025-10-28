import { parse, transform } from '@vue/compiler-dom';
import { TextMatch, TextReplacement } from '../types';
import { logger } from '../utils';

export interface TemplateTransformationResult {
  transformedTemplate: string;
  replacements: TextReplacement[];
  hasChanges: boolean;
}

export interface TemplateTransformationOptions {
  preserveFormatting: boolean;
  useAlias: boolean; // Use $t instead of t
}

/**
 * Transforms Vue templates by replacing hardcoded Persian/Arabic text with $t() calls
 */
export class TemplateTransformer {
  private options: TemplateTransformationOptions;

  constructor(options: Partial<TemplateTransformationOptions> = {}) {
    this.options = {
      preserveFormatting: true,
      useAlias: true,
      ...options
    };
  }

  /**
   * Transform Vue template by replacing matched text with i18n function calls
   */
  async transformTemplate(
    template: string,
    matches: TextMatch[],
    keyMap: Map<string, string>
  ): Promise<TemplateTransformationResult> {
    try {
      const replacements: TextReplacement[] = [];
      let transformedTemplate = template;
      let hasChanges = false;

      // Create a map of text to replacement key for quick lookup
      const textToKeyMap = new Map<string, string>();
      matches.forEach(match => {
        const key = keyMap.get(match.text);
        if (key) {
          textToKeyMap.set(match.text.trim(), key);
        }
      });

      // Sort matches by position (descending) to avoid position shifts during replacement
      const sortedMatches = matches
        .filter(match => match.context === 'template')
        .sort((a, b) => b.lineNumber - a.lineNumber || b.columnNumber - a.columnNumber);

      for (const match of sortedMatches) {
        const key = keyMap.get(match.text);
        if (!key) continue;

        const originalText = match.text.trim();
        const functionName = this.options.useAlias ? '$t' : 't';
        const replacement = `{{ ${functionName}('${key}') }}`;

        // Handle different contexts
        if (this.isInAttribute(template, match)) {
          // For attributes, use v-bind syntax
          transformedTemplate = this.replaceInAttribute(
            transformedTemplate,
            originalText,
            key,
            functionName
          );
        } else if (this.isInInterpolation(template, match)) {
          // Already in interpolation, just replace the text
          const interpolationReplacement = `${functionName}('${key}')`;
          transformedTemplate = this.replaceTextAtPosition(
            transformedTemplate,
            originalText,
            interpolationReplacement,
            match
          );
        } else {
          // Plain text content, wrap in interpolation
          transformedTemplate = this.replaceTextAtPosition(
            transformedTemplate,
            originalText,
            replacement,
            match
          );
        }

        replacements.push({
          originalText,
          replacementKey: key,
          position: {
            line: match.lineNumber,
            column: match.columnNumber
          }
        });

        hasChanges = true;
        logger.debug(`Replaced template text "${originalText}" with ${functionName}("${key}")`);
      }

      return {
        transformedTemplate,
        replacements,
        hasChanges
      };

    } catch (error) {
      logger.error('Error transforming template:', error as Error);
      throw new Error(`Template transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Replace text at a specific position in the template
   */
  private replaceTextAtPosition(
    template: string,
    originalText: string,
    replacement: string,
    match: TextMatch
  ): string {
    const lines = template.split('\n');
    const lineIndex = match.lineNumber - 1;
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const textIndex = line.indexOf(originalText, match.columnNumber - 1);
      
      if (textIndex !== -1) {
        lines[lineIndex] = 
          line.substring(0, textIndex) + 
          replacement + 
          line.substring(textIndex + originalText.length);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Check if text is within an attribute
   */
  private isInAttribute(template: string, match: TextMatch): boolean {
    const lines = template.split('\n');
    const lineIndex = match.lineNumber - 1;
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const beforeText = line.substring(0, match.columnNumber - 1);
      
      // Check if we're inside an attribute value
      const lastQuote = Math.max(beforeText.lastIndexOf('"'), beforeText.lastIndexOf("'"));
      const lastEquals = beforeText.lastIndexOf('=');
      
      return lastEquals > lastQuote && lastEquals !== -1;
    }
    
    return false;
  }

  /**
   * Check if text is already within an interpolation {{ }}
   */
  private isInInterpolation(template: string, match: TextMatch): boolean {
    const lines = template.split('\n');
    const lineIndex = match.lineNumber - 1;
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const beforeText = line.substring(0, match.columnNumber - 1);
      const afterText = line.substring(match.columnNumber - 1 + match.text.length);
      
      const lastOpenBrace = beforeText.lastIndexOf('{{');
      const lastCloseBrace = beforeText.lastIndexOf('}}');
      const nextCloseBrace = afterText.indexOf('}}');
      
      return lastOpenBrace > lastCloseBrace && nextCloseBrace !== -1;
    }
    
    return false;
  }

  /**
   * Replace text in attribute with v-bind syntax
   */
  private replaceInAttribute(
    template: string,
    originalText: string,
    key: string,
    functionName: string
  ): string {
    // Handle different attribute patterns
    const patterns = [
      // title="text" -> :title="$t('key')"
      new RegExp(`(\\w+)=["']([^"']*${this.escapeRegex(originalText)}[^"']*)["']`, 'g'),
      // :title="'text'" -> :title="$t('key')"
      new RegExp(`:(\\w+)=["']([^"']*${this.escapeRegex(originalText)}[^"']*)["']`, 'g'),
      // v-bind:title="'text'" -> v-bind:title="$t('key')"
      new RegExp(`v-bind:(\\w+)=["']([^"']*${this.escapeRegex(originalText)}[^"']*)["']`, 'g')
    ];

    let result = template;
    
    for (const pattern of patterns) {
      result = result.replace(pattern, (match, attrName, attrValue) => {
        if (attrValue.includes(originalText)) {
          const newValue = attrValue.replace(originalText, `${functionName}('${key}')`);
          return `:${attrName}="${newValue}"`;
        }
        return match;
      });
    }

    return result;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract template section from Vue SFC
   */
  extractTemplateFromVue(vueCode: string): string {
    const templateMatch = vueCode.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    return templateMatch ? templateMatch[1] : '';
  }

  /**
   * Replace template section in Vue SFC
   */
  replaceTemplateInVue(vueCode: string, newTemplate: string): string {
    return vueCode.replace(
      /<template[^>]*>([\s\S]*?)<\/template>/,
      `<template>\n${newTemplate}\n</template>`
    );
  }

  /**
   * Handle Vue directives that contain text
   */
  private transformDirectives(
    template: string,
    textToKeyMap: Map<string, string>,
    functionName: string
  ): { template: string; replacements: TextReplacement[] } {
    const replacements: TextReplacement[] = [];
    let result = template;

    // Handle v-text directive
    const vTextPattern = /v-text=["']([^"']+)["']/g;
    result = result.replace(vTextPattern, (match, content) => {
      const key = textToKeyMap.get(content.trim());
      if (key) {
        replacements.push({
          originalText: content,
          replacementKey: key,
          position: { line: 0, column: 0 } // Position will be updated by caller
        });
        return `v-text="${functionName}('${key}')"`;
      }
      return match;
    });

    // Handle v-html directive (be careful with this)
    const vHtmlPattern = /v-html=["']([^"']+)["']/g;
    result = result.replace(vHtmlPattern, (match, content) => {
      const key = textToKeyMap.get(content.trim());
      if (key) {
        replacements.push({
          originalText: content,
          replacementKey: key,
          position: { line: 0, column: 0 }
        });
        return `v-html="${functionName}('${key}')"`;
      }
      return match;
    });

    return { template: result, replacements };
  }

  /**
   * Handle placeholder attributes
   */
  private transformPlaceholders(
    template: string,
    textToKeyMap: Map<string, string>,
    functionName: string
  ): { template: string; replacements: TextReplacement[] } {
    const replacements: TextReplacement[] = [];
    let result = template;

    // Handle placeholder attributes
    const placeholderPattern = /placeholder=["']([^"']+)["']/g;
    result = result.replace(placeholderPattern, (match, content) => {
      const key = textToKeyMap.get(content.trim());
      if (key) {
        replacements.push({
          originalText: content,
          replacementKey: key,
          position: { line: 0, column: 0 }
        });
        return `:placeholder="${functionName}('${key}')"`;
      }
      return match;
    });

    // Handle title attributes
    const titlePattern = /title=["']([^"']+)["']/g;
    result = result.replace(titlePattern, (match, content) => {
      const key = textToKeyMap.get(content.trim());
      if (key) {
        replacements.push({
          originalText: content,
          replacementKey: key,
          position: { line: 0, column: 0 }
        });
        return `:title="${functionName}('${key}')"`;
      }
      return match;
    });

    return { template: result, replacements };
  }
}