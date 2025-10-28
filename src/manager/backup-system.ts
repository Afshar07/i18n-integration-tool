import * as fs from 'fs/promises';
import * as path from 'path';
import { I18nIntegrationConfig } from '../types';
import { logger } from '../utils';

export interface BackupInfo {
  id: string;
  timestamp: string;
  files: string[];
  description: string;
}

/**
 * Backup and restore system for translation files
 */
export class BackupSystem {
  private backupDir: string;

  constructor(private config: I18nIntegrationConfig) {
    this.backupDir = path.join(this.config.translationFiles.directory, '.backups');
  }

  /**
   * Create backup of translation files before modifications
   */
  async createBackup(description: string = 'Automatic backup'): Promise<string> {
    const backupId = this.generateBackupId();
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      // Ensure backup directory exists
      await this.ensureDirectoryExists(this.backupDir);
      await this.ensureDirectoryExists(backupPath);
      
      // Get all translation files
      const translationFiles = await this.getTranslationFiles();
      const backedUpFiles: string[] = [];
      
      // Copy each translation file to backup directory
      for (const filePath of translationFiles) {
        const fileName = path.basename(filePath);
        const backupFilePath = path.join(backupPath, fileName);
        
        try {
          await fs.copyFile(filePath, backupFilePath);
          backedUpFiles.push(fileName);
          logger.info(`Backed up file: ${fileName}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            logger.warn(`Failed to backup file ${fileName}: ${error.message}`);
          }
        }
      }
      
      // Create backup info file
      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: new Date().toISOString(),
        files: backedUpFiles,
        description
      };
      
      const infoPath = path.join(backupPath, 'backup-info.json');
      await fs.writeFile(infoPath, JSON.stringify(backupInfo, null, 2), 'utf-8');
      
      logger.info(`Created backup: ${backupId} with ${backedUpFiles.length} files`);
      return backupId;
    } catch (error: any) {
      logger.error(`Error creating backup:`, error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Restore translation files from a backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      // Check if backup exists
      await fs.access(backupPath);
      
      // Read backup info
      const infoPath = path.join(backupPath, 'backup-info.json');
      const infoContent = await fs.readFile(infoPath, 'utf-8');
      const backupInfo: BackupInfo = JSON.parse(infoContent);
      
      // Restore each file
      for (const fileName of backupInfo.files) {
        const backupFilePath = path.join(backupPath, fileName);
        const targetFilePath = path.join(this.config.translationFiles.directory, fileName);
        
        try {
          await fs.copyFile(backupFilePath, targetFilePath);
          logger.info(`Restored file: ${fileName}`);
        } catch (error: any) {
          logger.error(`Failed to restore file ${fileName}: ${error.message}`);
          throw error;
        }
      }
      
      logger.info(`Successfully restored backup: ${backupId}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      logger.error(`Error restoring backup ${backupId}:`, error);
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      await fs.access(this.backupDir);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // No backups directory exists yet
      }
      throw error;
    }
    
    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const backups: BackupInfo[] = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const infoPath = path.join(this.backupDir, entry.name, 'backup-info.json');
          
          try {
            const infoContent = await fs.readFile(infoPath, 'utf-8');
            const backupInfo: BackupInfo = JSON.parse(infoContent);
            backups.push(backupInfo);
          } catch (error: any) {
            logger.warn(`Invalid backup directory: ${entry.name}`);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return backups;
    } catch (error: any) {
      logger.error(`Error listing backups:`, error);
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      await fs.access(backupPath);
      await this.removeDirectory(backupPath);
      
      logger.info(`Deleted backup: ${backupId}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      logger.error(`Error deleting backup ${backupId}:`, error);
      throw new Error(`Failed to delete backup: ${error.message}`);
    }
  }

  /**
   * Clean up old backups, keeping only the specified number
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<void> {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= keepCount) {
        logger.info(`No cleanup needed. Current backups: ${backups.length}, Keep: ${keepCount}`);
        return;
      }
      
      const backupsToDelete = backups.slice(keepCount);
      let deletedCount = 0;
      
      for (const backup of backupsToDelete) {
        try {
          await this.deleteBackup(backup.id);
          deletedCount++;
        } catch (error: any) {
          logger.warn(`Failed to delete backup ${backup.id}: ${error.message}`);
        }
      }
      
      logger.info(`Cleaned up ${deletedCount} old backups`);
    } catch (error: any) {
      logger.error(`Error during backup cleanup:`, error);
      throw new Error(`Failed to cleanup old backups: ${error.message}`);
    }
  }

  /**
   * Get backup information by ID
   */
  async getBackupInfo(backupId: string): Promise<BackupInfo> {
    const infoPath = path.join(this.backupDir, backupId, 'backup-info.json');
    
    try {
      const infoContent = await fs.readFile(infoPath, 'utf-8');
      return JSON.parse(infoContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      throw new Error(`Failed to read backup info: ${error.message}`);
    }
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Get all translation file paths
   */
  private async getTranslationFiles(): Promise<string[]> {
    const translationDir = this.config.translationFiles.directory;
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(translationDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(path.join(translationDir, entry.name));
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn(`Error reading translation directory: ${error.message}`);
      }
    }
    
    return files;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Recursively remove directory and all contents
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.removeDirectory(fullPath);
      } else {
        await fs.unlink(fullPath);
      }
    }
    
    await fs.rmdir(dirPath);
  }
}