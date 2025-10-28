/**
 * Text scanning and extraction system
 * Exports all scanner components and utilities
 */

// Core scanner components
export { FileScanner, DEFAULT_SCAN_OPTIONS } from './file-scanner';
export type { 
  ScanOptions, 
  ScanResult, 
  ScanStats, 
  ScanError 
} from './file-scanner';

// AST parser for JavaScript/TypeScript
export { ASTParser, ASTParserUtils } from './ast-parser';
export type { 
  ASTParseOptions, 
  StringLiteralMatch 
} from './ast-parser';

// Vue parser for Single File Components
export { VueParser } from './vue-parser';
export type { 
  VueTextMatch, 
  VueParseResult 
} from './vue-parser';

// Text pattern matching utilities
export { 
  TextPatternMatcher, 
  TEXT_PATTERNS, 
  CONTEXT_PATTERNS,
  UNICODE_RANGES,
  PERSIAN_ARABIC_CHARS
} from './text-patterns';
export type { TextPattern } from './text-patterns';

// Re-export common types
export type { TextMatch } from '../types';