import fs from 'fs';
import path from 'path';
import {
  getStorageBaseDir,
  getConfigDirectory,
  getBackupsDirectory,
  ensureDirectoryExists
} from '../config/storage.js';

export class LocalFileRepository {
  private memoryCache: Map<string, any> = new Map();

  private get baseDir(): string {
    return getStorageBaseDir();
  }

  private get dbDir(): string {
    return getConfigDirectory();
  }

  private get backupsDir(): string {
    return getBackupsDirectory();
  }

  constructor() {
    this.initFolders();
  }

  private initFolders(): void {
    try {
      ensureDirectoryExists(this.dbDir);
      ensureDirectoryExists(this.backupsDir);
    } catch (err) {
      console.warn('[LocalFileRepository] Notice: Storage directory initialization warning:', (err as any)?.message || err);
    }
  }

  public checkConnection(): boolean {
    try {
      return fs.existsSync(this.baseDir);
    } catch {
      return false;
    }
  }

  public clearCache(filename?: string): void {
    if (filename) {
      this.memoryCache.delete(filename);
    } else {
      this.memoryCache.clear();
    }
  }

  public readJson<T>(filename: string, fallback: T): T {
    try {
      const filePath = path.join(this.dbDir, filename);
      if (!fs.existsSync(filePath)) {
        this.memoryCache.set(filename, fallback);
        return fallback;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as T;
      this.memoryCache.set(filename, parsed);
      return parsed;
    } catch (err) {
      console.warn(`[LocalFileRepository] Reading ${filename} falling back to default/cache:`, (err as any)?.message || err);
      return this.memoryCache.has(filename) ? (this.memoryCache.get(filename) as T) : fallback;
    }
  }

  public writeJson<T>(filename: string, data: T): boolean {
    this.memoryCache.set(filename, data);

    try {
      this.initFolders();
      const filePath = path.join(this.dbDir, filename);
      const tempPath = `${filePath}.${Date.now()}.tmp`;
      const content = JSON.stringify(data, null, 2);

      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, filePath);

      return true;
    } catch (err) {
      console.warn(`[LocalFileRepository] File write for ${filename} preserved in-memory:`, (err as any)?.message || err);
      return true;
    }
  }

  public createBackup(data: any): string | null {
    try {
      this.initFolders();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${timestamp}.json`;
      const filePath = path.join(this.backupsDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return filename;
    } catch (err) {
      console.warn('[LocalFileRepository] Warning creating local backup file:', (err as any)?.message || err);
      return null;
    }
  }

  public listBackups(): string[] {
    try {
      if (!fs.existsSync(this.backupsDir)) return [];
      return fs.readdirSync(this.backupsDir).filter((f) => f.endsWith('.json') || f.endsWith('.zip'));
    } catch {
      return [];
    }
  }

  public readBackup(filename: string): any | null {
    try {
      const filePath = path.join(this.backupsDir, filename);
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

export const localFileRepository = new LocalFileRepository();
export default localFileRepository;
