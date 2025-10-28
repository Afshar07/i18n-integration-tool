/**
 * Unicode regex patterns for detecting Persian/Arabic text
 * Supports comprehensive character ranges and various text contexts
 */

export interface TextPattern {
    name: string;
    pattern: RegExp;
    description: string;
}

/**
 * Unicode ranges for Persian and Arabic characters
 */
export const UNICODE_RANGES = {
    // Arabic block (U+0600-U+06FF)
    ARABIC_BASIC: '\u0600-\u06FF',

    // Arabic Supplement (U+0750-U+077F)
    ARABIC_SUPPLEMENT: '\u0750-\u077F',

    // Arabic Extended-A (U+08A0-U+08FF)
    ARABIC_EXTENDED_A: '\u08A0-\u08FF',

    // Arabic Extended-B (U+0870-U+089F)
    ARABIC_EXTENDED_B: '\u0870-\u089F',

    // Arabic Presentation Forms-A (U+FB50-U+FDFF)
    ARABIC_PRESENTATION_A: '\uFB50-\uFDFF',

    // Arabic Presentation Forms-B (U+FE70-U+FEFF)
    ARABIC_PRESENTATION_B: '\uFE70-\uFEFF',

    // Persian specific characters (subset of Arabic ranges)
    PERSIAN_SPECIFIC: '\u067E\u0686\u0698\u06AF\u06A9\u06CC',

    // Arabic Mathematical Alphabetic Symbols (U+1EE00-U+1EEFF)
    ARABIC_MATH: '\u{1EE00}-\u{1EEFF}',
} as const;

/**
 * Combined character class for all Persian/Arabic characters
 */
const PERSIAN_ARABIC_CHARS = [
    UNICODE_RANGES.ARABIC_BASIC,
    UNICODE_RANGES.ARABIC_SUPPLEMENT,
    UNICODE_RANGES.ARABIC_EXTENDED_A,
    UNICODE_RANGES.ARABIC_EXTENDED_B,
    UNICODE_RANGES.ARABIC_PRESENTATION_A,
    UNICODE_RANGES.ARABIC_PRESENTATION_B,
    UNICODE_RANGES.PERSIAN_SPECIFIC,
].join('');

/**
 * Core regex patterns for Persian/Arabic text detection
 */
export const TEXT_PATTERNS: Record<string, TextPattern> = {
    // Basic Persian/Arabic text detection
    BASIC_PERSIAN_ARABIC: {
        name: 'basic_persian_arabic',
        pattern: new RegExp(`[${PERSIAN_ARABIC_CHARS}]`, 'u'),
        description: 'Detects any Persian or Arabic character'
    },

    // Persian/Arabic words (sequences of characters)
    PERSIAN_ARABIC_WORDS: {
        name: 'persian_arabic_words',
        pattern: new RegExp(`[${PERSIAN_ARABIC_CHARS}\\s]+`, 'gu'),
        description: 'Detects Persian/Arabic words and phrases'
    },

    // String literals containing Persian/Arabic text
    STRING_LITERALS: {
        name: 'string_literals',
        pattern: new RegExp(`(['"\`])([^'"\`]*[${PERSIAN_ARABIC_CHARS}][^'"\`]*)\\1`, 'gu'),
        description: 'Detects string literals containing Persian/Arabic text'
    },

    // Template literals with Persian/Arabic text
    TEMPLATE_LITERALS: {
        name: 'template_literals',
        pattern: new RegExp(`\`([^\`]*[${PERSIAN_ARABIC_CHARS}][^\`]*)\``, 'gu'),
        description: 'Detects template literals containing Persian/Arabic text'
    },

    // Vue template interpolations
    VUE_INTERPOLATIONS: {
        name: 'vue_interpolations',
        pattern: new RegExp(`\\{\\{([^}]*[${PERSIAN_ARABIC_CHARS}][^}]*)\\}\\}`, 'gu'),
        description: 'Detects Vue template interpolations with Persian/Arabic text'
    },

    // HTML/Vue attribute values
    ATTRIBUTE_VALUES: {
        name: 'attribute_values',
        pattern: new RegExp(`\\w+\\s*=\\s*(['"])([^'"]*[${PERSIAN_ARABIC_CHARS}][^'"]*)\\1`, 'gu'),
        description: 'Detects HTML/Vue attribute values containing Persian/Arabic text'
    },

    // Vue directive values (v-text, v-html, etc.)
    VUE_DIRECTIVE_VALUES: {
        name: 'vue_directive_values',
        pattern: new RegExp(`v-\\w+\\s*=\\s*(['"])([^'"]*[${PERSIAN_ARABIC_CHARS}][^'"]*)\\1`, 'gu'),
        description: 'Detects Vue directive values containing Persian/Arabic text'
    },

    // Text content between HTML tags
    HTML_TEXT_CONTENT: {
        name: 'html_text_content',
        pattern: new RegExp(`>([^<]*[${PERSIAN_ARABIC_CHARS}][^<]*)<`, 'gu'),
        description: 'Detects text content between HTML tags'
    },

    // Mixed text (Persian/Arabic with Latin characters)
    MIXED_TEXT: {
        name: 'mixed_text',
        pattern: new RegExp(`[a-zA-Z\\s]*[${PERSIAN_ARABIC_CHARS}][a-zA-Z\\s${PERSIAN_ARABIC_CHARS}]*|[${PERSIAN_ARABIC_CHARS}][a-zA-Z\\s${PERSIAN_ARABIC_CHARS}]*[a-zA-Z\\s]*`, 'gu'),
        description: 'Detects mixed Persian/Arabic and Latin text'
    }
};

/**
 * Context-specific patterns for different file types
 */
export const CONTEXT_PATTERNS = {
    // JavaScript/TypeScript contexts
    JS_TS: [
        TEXT_PATTERNS.STRING_LITERALS,
        TEXT_PATTERNS.TEMPLATE_LITERALS
    ],

    // Vue template contexts
    VUE_TEMPLATE: [
        TEXT_PATTERNS.VUE_INTERPOLATIONS,
        TEXT_PATTERNS.ATTRIBUTE_VALUES,
        TEXT_PATTERNS.VUE_DIRECTIVE_VALUES,
        TEXT_PATTERNS.HTML_TEXT_CONTENT
    ],

    // General HTML contexts
    HTML: [
        TEXT_PATTERNS.ATTRIBUTE_VALUES,
        TEXT_PATTERNS.HTML_TEXT_CONTENT
    ]
};

/**
 * Utility functions for text pattern matching
 */
export class TextPatternMatcher {
    /**
     * Check if text contains Persian/Arabic characters
     */
    static containsPersianArabic(text: string): boolean {
        return TEXT_PATTERNS.BASIC_PERSIAN_ARABIC.pattern.test(text);
    }

    /**
     * Extract all Persian/Arabic text matches from content
     */
    static extractMatches(content: string, patterns: TextPattern[]): Array<{
        text: string;
        pattern: string;
        index: number;
        length: number;
    }> {
        const matches: Array<{
            text: string;
            pattern: string;
            index: number;
            length: number;
        }> = [];

        for (const pattern of patterns) {
            const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
            let match;

            while ((match = regex.exec(content)) !== null) {
                // Extract the actual Persian/Arabic text from the match
                const matchedText = match[2] || match[1] || match[0];

                if (this.containsPersianArabic(matchedText)) {
                    matches.push({
                        text: matchedText.trim(),
                        pattern: pattern.name,
                        index: match.index,
                        length: match[0].length
                    });
                }
            }
        }

        return matches;
    }

    /**
     * Get appropriate patterns for file context
     */
    static getPatternsForContext(context: 'js' | 'ts' | 'vue' | 'html'): TextPattern[] {
        switch (context) {
            case 'js':
            case 'ts':
                return CONTEXT_PATTERNS.JS_TS;
            case 'vue':
                return CONTEXT_PATTERNS.VUE_TEMPLATE;
            case 'html':
                return CONTEXT_PATTERNS.HTML;
            default:
                return Object.values(TEXT_PATTERNS);
        }
    }

    /**
     * Clean extracted text by removing extra whitespace and quotes
     */
    static cleanExtractedText(text: string): string {
        return text
            .trim()
            .replace(/^['"`]|['"`]$/g, '') // Remove surrounding quotes
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Validate if extracted text is meaningful (not just punctuation or numbers)
     */
    static isValidText(text: string): boolean {
        const cleanText = this.cleanExtractedText(text);

        // Must contain at least one Persian/Arabic character
        if (!this.containsPersianArabic(cleanText)) {
            return false;
        }

        // Must be longer than 1 character
        if (cleanText.length < 2) {
            return false;
        }

        // Should not be only punctuation or numbers
        const nonPersianArabicChars = cleanText.replace(new RegExp(`[${PERSIAN_ARABIC_CHARS}\\s]`, 'gu'), '');
        const isPunctuationOnly = /^[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0870-\u089F\uFB50-\uFDFF\uFE70-\uFEFF]+$/.test(nonPersianArabicChars);

        return !isPunctuationOnly;
    }
}

/**
 * Export commonly used patterns and utilities
 */
export {
    PERSIAN_ARABIC_CHARS
};