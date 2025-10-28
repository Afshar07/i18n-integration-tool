/**
 * Vue template parser for extracting Persian/Arabic text from Vue Single File Components
 * Handles templates, attributes, directives, and interpolations
 */

import { parse as parseVue, SFCDescriptor } from '@vue/compiler-sfc';
import { TextPatternMatcher, TEXT_PATTERNS } from './text-patterns';
import { TextMatch } from '../types';

export interface VueTextMatch extends TextMatch {
  section: 'template' | 'script' | 'style';
  elementType?: string;
  attributeName?: string;
  directiveName?: string;
  isInterpolation?: boolean;
  isDirective?: boolean;
  isAttribute?: boolean;
  isTextContent?: boolean;
}

export interface VueParseResult {
  template: VueTextMatch[];
  script: VueTextMatch[];
  style: VueTextMatch[];
  errors: string[];
}

/**
 * Vue Single File Component parser
 */
export class VueParser {
  /**
   * Parse Vue SFC content and extract Persian/Arabic text
   */
  async parseVueFile(content: string, filePath: string): Promise<VueParseResult> {
    const result: VueParseResult = {
      template: [],
      script: [],
      style: [],
      errors: []
    };

    try {
      const { descriptor, errors } = parseVue(content, { filename: filePath });

      // Add any parsing errors
      if (errors.length > 0) {
        result.errors.push(...errors.map(err => err.message));
      }

      // Parse template section
      if (descriptor.template) {
        result.template = await this.parseTemplateSection(
          descriptor.template.content,
          filePath,
          descriptor.template.loc.start.line
        );
      }

      // Parse script section
      if (descriptor.script) {
        result.script = await this.parseScriptSection(
          descriptor.script.content,
          filePath,
          descriptor.script.loc.start.line
        );
      }

      // Parse style section (for CSS content with Persian/Arabic)
      if (descriptor.styles && descriptor.styles.length > 0) {
        for (const style of descriptor.styles) {
          const styleMatches = await this.parseStyleSection(
            style.content,
            filePath,
            style.loc.start.line
          );
          result.style.push(...styleMatches);
        }
      }

    } catch (error) {
      result.errors.push(`Failed to parse Vue file: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Parse Vue template section
   */
  private async parseTemplateSection(
    templateContent: string,
    filePath: string,
    startLine: number = 1
  ): Promise<VueTextMatch[]> {
    const matches: VueTextMatch[] = [];

    // Extract Vue interpolations {{ }}
    const interpolationMatches = this.extractInterpolations(templateContent, filePath, startLine);
    matches.push(...interpolationMatches);

    // Extract attribute values
    const attributeMatches = this.extractAttributeValues(templateContent, filePath, startLine);
    matches.push(...attributeMatches);

    // Extract Vue directive values
    const directiveMatches = this.extractDirectiveValues(templateContent, filePath, startLine);
    matches.push(...directiveMatches);

    // Extract text content between tags
    const textContentMatches = this.extractTextContent(templateContent, filePath, startLine);
    matches.push(...textContentMatches);

    return matches;
  }

  /**
   * Parse script section (delegate to AST parser if needed)
   */
  private async parseScriptSection(
    scriptContent: string,
    filePath: string,
    startLine: number = 1
  ): Promise<VueTextMatch[]> {
    const matches: VueTextMatch[] = [];

    // Use simple regex patterns for script content
    // For more complex parsing, we would delegate to ASTParser
    const stringMatches = TextPatternMatcher.extractMatches(
      scriptContent,
      [TEXT_PATTERNS.STRING_LITERALS, TEXT_PATTERNS.TEMPLATE_LITERALS]
    );

    for (const match of stringMatches) {
      const lineNumber = this.calculateLineNumber(scriptContent, match.index, startLine);
      matches.push({
        text: match.text,
        filePath,
        lineNumber,
        columnNumber: this.calculateColumnNumber(scriptContent, match.index),
        context: 'script',
        section: 'script'
      });
    }

    return matches;
  }

  /**
   * Parse style section
   */
  private async parseStyleSection(
    styleContent: string,
    filePath: string,
    startLine: number = 1
  ): Promise<VueTextMatch[]> {
    const matches: VueTextMatch[] = [];

    // Extract Persian/Arabic text from CSS content (like content properties)
    const cssContentPattern = /content\s*:\s*(['"])([^'"]*[${TEXT_PATTERNS.BASIC_PERSIAN_ARABIC.pattern.source}][^'"]*)\1/gu;
    let match;

    while ((match = cssContentPattern.exec(styleContent)) !== null) {
      const text = match[2];
      if (TextPatternMatcher.containsPersianArabic(text) && TextPatternMatcher.isValidText(text)) {
        const lineNumber = this.calculateLineNumber(styleContent, match.index, startLine);
        matches.push({
          text: TextPatternMatcher.cleanExtractedText(text),
          filePath,
          lineNumber,
          columnNumber: this.calculateColumnNumber(styleContent, match.index),
          context: 'style',
          section: 'style'
        });
      }
    }

    return matches;
  }

  /**
   * Extract Vue interpolations {{ }}
   */
  private extractInterpolations(content: string, filePath: string, startLine: number): VueTextMatch[] {
    const matches: VueTextMatch[] = [];
    const interpolationPattern = /\{\{([^}]*)\}\}/g;
    let match;

    while ((match = interpolationPattern.exec(content)) !== null) {
      const interpolationContent = match[1].trim();
      
      // Check if interpolation contains Persian/Arabic text (string literals)
      const stringMatches = TextPatternMatcher.extractMatches(
        interpolationContent,
        [TEXT_PATTERNS.STRING_LITERALS]
      );

      for (const stringMatch of stringMatches) {
        if (TextPatternMatcher.isValidText(stringMatch.text)) {
          const lineNumber = this.calculateLineNumber(content, match.index, startLine);
          matches.push({
            text: stringMatch.text,
            filePath,
            lineNumber,
            columnNumber: this.calculateColumnNumber(content, match.index),
            context: 'template',
            section: 'template',
            isInterpolation: true
          });
        }
      }
    }

    return matches;
  }

  /**
   * Extract attribute values
   */
  private extractAttributeValues(content: string, filePath: string, startLine: number): VueTextMatch[] {
    const matches: VueTextMatch[] = [];
    
    // Pattern for HTML/Vue attributes: attribute="value"
    const attributePattern = /(\w+(?:-\w+)*)\s*=\s*(['"])([^'"]*)\2/g;
    let match;

    while ((match = attributePattern.exec(content)) !== null) {
      const attributeName = match[1];
      const attributeValue = match[3];

      if (TextPatternMatcher.containsPersianArabic(attributeValue) && TextPatternMatcher.isValidText(attributeValue)) {
        const lineNumber = this.calculateLineNumber(content, match.index, startLine);
        matches.push({
          text: TextPatternMatcher.cleanExtractedText(attributeValue),
          filePath,
          lineNumber,
          columnNumber: this.calculateColumnNumber(content, match.index),
          context: 'template',
          section: 'template',
          attributeName,
          isAttribute: true
        });
      }
    }

    return matches;
  }

  /**
   * Extract Vue directive values
   */
  private extractDirectiveValues(content: string, filePath: string, startLine: number): VueTextMatch[] {
    const matches: VueTextMatch[] = [];
    
    // Pattern for Vue directives: v-directive="value" or :prop="value" or @event="value"
    const directivePatterns = [
      /v-(\w+(?:\.\w+)*)\s*=\s*(['"])([^'"]*)\2/g, // v-text, v-html, etc.
      /:(\w+(?:-\w+)*)\s*=\s*(['"])([^'"]*)\2/g,   // :prop bindings
      /@(\w+(?:\.\w+)*)\s*=\s*(['"])([^'"]*)\2/g   // @event handlers
    ];

    for (const pattern of directivePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const directiveName = match[1];
        const directiveValue = match[3];

        // Check if directive value contains Persian/Arabic text
        if (TextPatternMatcher.containsPersianArabic(directiveValue) && TextPatternMatcher.isValidText(directiveValue)) {
          const lineNumber = this.calculateLineNumber(content, match.index, startLine);
          matches.push({
            text: TextPatternMatcher.cleanExtractedText(directiveValue),
            filePath,
            lineNumber,
            columnNumber: this.calculateColumnNumber(content, match.index),
            context: 'template',
            section: 'template',
            directiveName,
            isDirective: true
          });
        }
      }
    }

    return matches;
  }

  /**
   * Extract text content between HTML tags
   */
  private extractTextContent(content: string, filePath: string, startLine: number): VueTextMatch[] {
    const matches: VueTextMatch[] = [];
    
    // Pattern for text content between tags: >text content<
    // This is more complex because we need to avoid script/style content
    const textContentPattern = />([^<]+)</g;
    let match;

    while ((match = textContentPattern.exec(content)) !== null) {
      const textContent = match[1].trim();
      
      // Skip empty content or content that's just whitespace
      if (!textContent) continue;
      
      // Skip content that looks like Vue interpolations (will be handled separately)
      if (textContent.includes('{{') && textContent.includes('}}')) continue;

      if (TextPatternMatcher.containsPersianArabic(textContent) && TextPatternMatcher.isValidText(textContent)) {
        const lineNumber = this.calculateLineNumber(content, match.index, startLine);
        
        // Try to determine the element type
        const elementType = this.getElementType(content, match.index);
        
        matches.push({
          text: TextPatternMatcher.cleanExtractedText(textContent),
          filePath,
          lineNumber,
          columnNumber: this.calculateColumnNumber(content, match.index),
          context: 'template',
          section: 'template',
          elementType,
          isTextContent: true
        });
      }
    }

    return matches;
  }

  /**
   * Get the element type for text content
   */
  private getElementType(content: string, matchIndex: number): string | undefined {
    // Look backwards to find the opening tag
    const beforeMatch = content.substring(0, matchIndex);
    const tagMatch = beforeMatch.match(/<(\w+)[^>]*>$/);
    return tagMatch ? tagMatch[1] : undefined;
  }

  /**
   * Calculate line number from string index
   */
  private calculateLineNumber(content: string, index: number, startLine: number = 1): number {
    const beforeIndex = content.substring(0, index);
    const lineBreaks = (beforeIndex.match(/\n/g) || []).length;
    return startLine + lineBreaks;
  }

  /**
   * Calculate column number from string index
   */
  private calculateColumnNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    const lastLineBreak = beforeIndex.lastIndexOf('\n');
    return lastLineBreak === -1 ? index : index - lastLineBreak - 1;
  }

  /**
   * Check if a file is a Vue Single File Component
   */
  static isVueFile(filePath: string): boolean {
    return filePath.endsWith('.vue');
  }

  /**
   * Extract only template matches from Vue file
   */
  async parseTemplateOnly(content: string, filePath: string): Promise<VueTextMatch[]> {
    try {
      const { descriptor } = parseVue(content, { filename: filePath });
      
      if (descriptor.template) {
        return await this.parseTemplateSection(
          descriptor.template.content,
          filePath,
          descriptor.template.loc.start.line
        );
      }
      
      return [];
    } catch (error) {
      throw new Error(`Failed to parse Vue template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get Vue-specific parsing statistics
   */
  static getParsingStats(results: VueParseResult[]): {
    totalFiles: number;
    totalMatches: number;
    templateMatches: number;
    scriptMatches: number;
    styleMatches: number;
    interpolations: number;
    directives: number;
    attributes: number;
    textContent: number;
  } {
    const stats = {
      totalFiles: results.length,
      totalMatches: 0,
      templateMatches: 0,
      scriptMatches: 0,
      styleMatches: 0,
      interpolations: 0,
      directives: 0,
      attributes: 0,
      textContent: 0
    };

    for (const result of results) {
      stats.templateMatches += result.template.length;
      stats.scriptMatches += result.script.length;
      stats.styleMatches += result.style.length;
      stats.totalMatches += result.template.length + result.script.length + result.style.length;

      // Count specific types
      for (const match of result.template) {
        if (match.isInterpolation) stats.interpolations++;
        if (match.isDirective) stats.directives++;
        if (match.isAttribute) stats.attributes++;
        if (match.isTextContent) stats.textContent++;
      }
    }

    return stats;
  }
}

export default VueParser;