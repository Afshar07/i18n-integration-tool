import { GeneratedKey, KeyGenerationOptions } from '../types';
import { logger } from '../utils';

/**
 * Persian/Arabic to English transliteration mapping
 */
const TRANSLITERATION_MAP: Record<string, string> = {
  // Persian/Farsi characters
  'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's',
  'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h',
  'ی': 'i', 'ء': '', 'ئ': 'y', 'ؤ': 'v',

  // Arabic characters
  'ك': 'k', 'ي': 'y', 'ة': 'h',

  // Common Persian words for better semantic meaning
  'سلام': 'hello', 'خوش آمدید': 'welcome', 'ورود': 'login', 'خروج': 'logout',
  'ثبت نام': 'register', 'رمز عبور': 'password', 'نام کاربری': 'username',
  'تایید': 'confirm', 'لغو': 'cancel', 'ذخیره': 'save', 'حذف': 'delete',
  'ویرایش': 'edit', 'جدید': 'new', 'قدیمی': 'old', 'بعدی': 'next', 'قبلی': 'previous',
  'صفحه': 'page', 'فهرست': 'list', 'جستجو': 'search', 'فیلتر': 'filter',
  'تنظیمات': 'settings', 'پروفایل': 'profile', 'حساب کاربری': 'account',
  'اطلاعات': 'information', 'جزئیات': 'details', 'توضیحات': 'description',
  'نام': 'name', 'نام خانوادگی': 'lastname', 'ایمیل': 'email', 'تلفن': 'phone',
  'آدرس': 'address', 'شهر': 'city', 'کشور': 'country', 'تاریخ': 'date',
  'زمان': 'time', 'ساعت': 'hour', 'دقیقه': 'minute', 'روز': 'day', 'ماه': 'month',
  'سال': 'year', 'امروز': 'today', 'دیروز': 'yesterday', 'فردا': 'tomorrow',
  'خطا': 'error', 'موفقیت': 'success', 'هشدار': 'warning', 'اطلاع': 'info',
  'بله': 'yes', 'خیر': 'no', 'باشه': 'ok', 'باطل': 'cancel'
};

/**
 * Key generator for creating English translation keys from Persian/Arabic text
 */
export class KeyGenerator {
  private usedKeys = new Set<string>();

  constructor(private options: KeyGenerationOptions) { }

  /**
   * Generate a meaningful English key from Persian/Arabic text
   */
  generateKey(text: string, context?: string): GeneratedKey {
    logger.info(`Generating key for text: "${text}"`);

    const normalizedText = this.normalizeText(text);
    const transliteratedText = this.transliterateText(normalizedText);
    const semanticKey = this.createSemanticKey(transliteratedText, context);
    const finalKey = this.ensureUniqueness(semanticKey);

    const confidence = this.calculateConfidence(text, finalKey);

    logger.info(`Generated key: "${finalKey}" with confidence: ${confidence}`);

    return {
      key: finalKey,
      originalText: text,
      confidence,
      suggestions: this.generateAlternatives(text, context)
    };
  }

  /**
   * Normalize text by removing extra whitespace and punctuation
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[۰-۹]/g, (match) => String.fromCharCode(match.charCodeAt(0) - '۰'.charCodeAt(0) + '0'.charCodeAt(0))) // Persian digits to English
      .replace(/[٠-٩]/g, (match) => String.fromCharCode(match.charCodeAt(0) - '٠'.charCodeAt(0) + '0'.charCodeAt(0))) // Arabic digits to English
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\w]/g, ''); // Keep only Persian/Arabic letters, spaces, and English alphanumeric
  }

  /**
   * Transliterate Persian/Arabic text to English
   */
  private transliterateText(text: string): string {
    // First check for complete word matches
    const lowerText = text.toLowerCase();
    for (const [persian, english] of Object.entries(TRANSLITERATION_MAP)) {
      if (lowerText === persian.toLowerCase()) {
        return english;
      }
    }

    // Check for partial word matches
    let result = text;
    for (const [persian, english] of Object.entries(TRANSLITERATION_MAP)) {
      if (persian.length > 1) { // Multi-character mappings first
        result = result.replace(new RegExp(persian, 'g'), english);
      }
    }

    // Then single character mappings
    result = result.split('').map(char => {
      return TRANSLITERATION_MAP[char] || char;
    }).join('');

    return result;
  }

  /**
   * Create a semantic key with proper formatting
   */
  private createSemanticKey(transliteratedText: string, context?: string): string {
    let key = transliteratedText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric except spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    // Add context prefix if provided and useContext is enabled
    if (this.options.useContext && context) {
      const contextKey = context.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (contextKey) {
        key = `${contextKey}_${key}`;
      }
    }

    // Add prefix if specified
    if (this.options.prefix) {
      key = `${this.options.prefix}_${key}`;
    }

    // Ensure key is not empty
    if (!key) {
      key = 'untranslated_text';
    }

    // Apply length constraints
    if (key.length > this.options.maxLength) {
      key = this.truncateKey(key);
    }

    return key;
  }

  /**
   * Truncate key while maintaining readability
   */
  private truncateKey(key: string): string {
    if (key.length <= this.options.maxLength) {
      return key;
    }

    const parts = key.split('_');

    // If single word, truncate directly
    if (parts.length === 1) {
      return key.substring(0, this.options.maxLength);
    }

    // Try to keep meaningful parts
    let result = '';
    for (const part of parts) {
      if (result.length + part.length + 1 <= this.options.maxLength) {
        result += (result ? '_' : '') + part;
      } else {
        // Add abbreviated version if space allows
        const abbreviated = part.substring(0, Math.max(1, this.options.maxLength - result.length - 1));
        if (abbreviated.length > 0) {
          result += (result ? '_' : '') + abbreviated;
        }
        break;
      }
    }

    return result || key.substring(0, this.options.maxLength);
  }

  /**
   * Ensure key uniqueness by adding suffixes
   */
  private ensureUniqueness(key: string): string {
    let uniqueKey = key;
    let counter = 1;

    while (this.usedKeys.has(uniqueKey)) {
      uniqueKey = `${key}_${counter}`;
      counter++;
    }

    this.usedKeys.add(uniqueKey);
    return uniqueKey;
  }

  /**
   * Calculate confidence score for the generated key
   */
  private calculateConfidence(originalText: string, generatedKey: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for exact word matches
    const lowerOriginal = originalText.toLowerCase();
    for (const persian of Object.keys(TRANSLITERATION_MAP)) {
      if (persian.length > 1 && lowerOriginal.includes(persian.toLowerCase())) {
        confidence += 0.3;
        break;
      }
    }

    // Higher confidence for meaningful keys (not just transliteration)
    if (generatedKey.includes('_') && generatedKey.length > 3) {
      confidence += 0.1;
    }

    // Lower confidence for very short or generic keys
    if (generatedKey.length < 3 || generatedKey === 'untranslated_text') {
      confidence -= 0.2;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate alternative key suggestions
   */
  private generateAlternatives(text: string, context?: string): string[] {
    const alternatives: string[] = [];
    const normalizedText = this.normalizeText(text);

    // Try different transliteration approaches
    const simpleTransliteration = this.transliterateText(normalizedText)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');

    if (simpleTransliteration) {
      alternatives.push(simpleTransliteration);
    }

    // Try with different context
    if (context) {
      const contextualKey = `${context.toLowerCase()}_${simpleTransliteration}`;
      alternatives.push(contextualKey);
    }

    // Try abbreviated version
    const words = normalizedText.split(/\s+/);
    if (words.length > 1) {
      const abbreviated = words.map(word => {
        const transliterated = this.transliterateText(word);
        return transliterated.charAt(0);
      }).join('_');

      if (abbreviated.length > 1) {
        alternatives.push(abbreviated);
      }
    }

    return alternatives.slice(0, 3); // Return max 3 alternatives
  }

  /**
   * Reset used keys (useful for testing or new sessions)
   */
  resetUsedKeys(): void {
    this.usedKeys.clear();
  }

  /**
   * Add existing keys to prevent duplicates
   */
  addExistingKeys(keys: string[]): void {
    keys.forEach(key => this.usedKeys.add(key));
  }
}