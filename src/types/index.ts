// Core interfaces and types for the i18n integration tool

export interface TextMatch {
  text: string;
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  context: 'template' | 'script' | 'style';
  parentElement?: string;
}

export interface ScanResult {
  matches: TextMatch[];
  totalFiles: number;
  processedFiles: number;
  errors: string[];
}

export interface KeyGenerationOptions {
  maxLength: number;
  useContext: boolean;
  prefix?: string;
}

export interface GeneratedKey {
  key: string;
  originalText: string;
  confidence: number;
  suggestions?: string[];
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  context?: string;
}

export interface TransformationResult {
  filePath: string;
  originalContent: string;
  transformedContent: string;
  addedImports: string[];
  replacements: TextReplacement[];
}

export interface TextReplacement {
  originalText: string;
  replacementKey: string;
  position: { line: number; column: number };
}

export interface TranslationEntry {
  key: string;
  value: string;
  locale: string;
  metadata?: {
    addedDate: string;
    sourceFile: string;
    confidence: number;
  };
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingKey?: string;
  similarKeys: string[];
}

export interface TranslationData {
  locales: {
    [locale: string]: {
      [key: string]: string;
    };
  };
  metadata: {
    version: string;
    lastUpdated: string;
    totalKeys: number;
    generatedKeys: number;
  };
}

export interface I18nIntegrationConfig {
  sourceDirectories: string[];
  excludePatterns: string[];
  locales: {
    source: string; // 'fa'
    target: string; // 'en'
  };
  keyGeneration: {
    strategy: 'semantic' | 'hash' | 'sequential';
    maxLength: number;
    useContext: boolean;
  };
  fileProcessing: {
    createBackups: boolean;
    dryRun: boolean;
    batchSize: number;
  };
  translationFiles: {
    directory: string;
    format: 'json' | 'yaml';
  };
}

export interface ProcessingState {
  phase: 'scanning' | 'generating' | 'transforming' | 'validating';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: {
    scannedFiles: number;
    foundStrings: number;
    generatedKeys: number;
    transformedFiles: number;
    errors: string[];
  };
}

export class FileSystemError extends Error {
  code: string;
  path: string;
  
  constructor(message: string, code: string, path: string) {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
    this.path = path;
  }
}

export class ParsingError extends Error {
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
  
  constructor(message: string, filePath: string, lineNumber?: number, columnNumber?: number) {
    super(message);
    this.name = 'ParsingError';
    this.filePath = filePath;
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
  }
}

export class TranslationError extends Error {
  key?: string;
  locale?: string;
  
  constructor(message: string, key?: string, locale?: string) {
    super(message);
    this.name = 'TranslationError';
    this.key = key;
    this.locale = locale;
  }
}

export class IntegrationError extends Error {
  component: string;
  details: string;
  
  constructor(message: string, component: string, details: string) {
    super(message);
    this.name = 'IntegrationError';
    this.component = component;
    this.details = details;
  }
}

export type ProcessingError = FileSystemError | ParsingError | TranslationError | IntegrationError;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ErrorReport {
  timestamp: string;
  totalErrors: number;
  errorsByType: Record<string, number>;
  errors: ProcessingError[];
  suggestions: string[];
}

export interface WorkflowResult {
  success: boolean;
  phase: string;
  scanResult?: ScanResult;
  generatedKeys?: GeneratedKey[];
  transformationResults?: TransformationResult[];
  validationResult?: ValidationResult;
  errors: ProcessingError[];
  warnings: string[];
  executionTime: number;
  processedFiles: number;
}