import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { FileSystemError } from '../types';

/**
 * Core file operation utilities for the i18n integration tool
 */
export class FileOperations {
  /**
   * Safely read a file with error handling
   */
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
      const fsError = new Error(`Failed to read file: ${filePath}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = filePath;
      throw fsError;
    }
  }

  /**
   * Safely write a file with error handling and directory creation
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error: any) {
      const fsError = new Error(`Failed to write file: ${filePath}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = filePath;
      throw fsError;
    }
  }

  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is a directory
   */
  static async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Create a backup of a file
   */
  static async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;

    try {
      const content = await this.readFile(filePath);
      await this.writeFile(backupPath, content);
      return backupPath;
    } catch (error: any) {
      const fsError = new Error(`Failed to create backup for: ${filePath}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = filePath;
      throw fsError;
    }
  }

  /**
   * Find files matching patterns with exclusions
   */
  static async findFiles(
    patterns: string[],
    options: {
      cwd?: string;
      exclude?: string[];
      absolute?: boolean;
    } = {}
  ): Promise<string[]> {
    const { cwd = process.cwd(), exclude = [], absolute = true } = options;

    try {
      const allFiles: string[] = [];

      for (const pattern of patterns) {
        const files = await glob(pattern, {
          cwd,
          ignore: exclude,
          absolute,
          nodir: true
        });
        allFiles.push(...files);
      }

      // Remove duplicates
      return [...new Set(allFiles)];
    } catch (error: any) {
      const fsError = new Error(`Failed to find files with patterns: ${patterns.join(', ')}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = cwd;
      throw fsError;
    }
  }

  /**
   * Copy a file from source to destination
   */
  static async copyFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      const content = await this.readFile(sourcePath);
      await this.writeFile(destPath, content);
    } catch (error: any) {
      const fsError = new Error(`Failed to copy file from ${sourcePath} to ${destPath}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = sourcePath;
      throw fsError;
    }
  }

  /**
   * Get file stats (size, modification time, etc.)
   */
  static async getFileStats(filePath: string): Promise<Stats> {
    try {
      return await fs.stat(filePath);
    } catch (error: any) {
      const fsError = new Error(`Failed to get stats for file: ${filePath}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = filePath;
      throw fsError;
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      const fsError = new Error(`Failed to create directory: ${dirPath}`) as FileSystemError;
      fsError.code = error.code;
      fsError.path = dirPath;
      throw fsError;
    }
  }

  /**
   * Read and parse JSON file safely
   */
  static async readJsonFile<T = any>(filePath: string): Promise<T> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === 'SyntaxError') {
        const parseError = new Error(`Invalid JSON in file: ${filePath}`) as FileSystemError;
        parseError.code = 'INVALID_JSON';
        parseError.path = filePath;
        throw parseError;
      }
      throw error;
    }
  }

  /**
   * Write JSON file with proper formatting
   */
  static async writeJsonFile(filePath: string, data: any, indent: number = 2): Promise<void> {
    const content = JSON.stringify(data, null, indent);
    await this.writeFile(filePath, content);
  }

  /**
   * Get relative path from base directory
   */
  static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Resolve absolute path
   */
  static resolvePath(...paths: string[]): string {
    return path.resolve(...paths);
  }

  /**
   * Get file extension
   */
  static getFileExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Get filename without extension
   */
  static getBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }
}