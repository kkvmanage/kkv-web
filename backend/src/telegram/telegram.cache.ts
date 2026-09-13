import fs from 'fs';
import path from 'path';
import {
  EntityType,
  TelegramIndexEntry,
  TelegramIndexMap,
  TelegramRecordEnvelope
} from './telegram.types.js';
import { getStorageSubdirectory, ensureDirectoryExists } from '../config/storage.js';

export class TelegramCache {
  private cacheDir: string;
  private indexPath: string;
  private dataDir: string;

  // In-memory lookup: EntityType -> Map<entityId, TelegramRecordEnvelope>
  private store: Map<EntityType, Map<string, TelegramRecordEnvelope>> = new Map();

  // In-memory index: `${type}:${id}` -> TelegramIndexEntry
  private index: TelegramIndexMap = {};

  private isLoaded = false;

  constructor() {
    this.cacheDir = getStorageSubdirectory('telegram');
    this.dataDir = path.join(this.cacheDir, 'entities');
    this.indexPath = path.join(this.cacheDir, 'telegram_index.json');
    this.initDirs();
    this.loadFromDisk();
  }

  private initDirs(): void {
    try {
      ensureDirectoryExists(this.cacheDir);
      ensureDirectoryExists(this.dataDir);
    } catch (err) {
      console.warn('[TelegramCache] Directory init warning:', err);
    }
  }

  /**
   * Loads cached index and entities from disk on startup
   */
  public loadFromDisk(): void {
    try {
      this.initDirs();
      if (fs.existsSync(this.indexPath)) {
        const raw = fs.readFileSync(this.indexPath, 'utf-8');
        this.index = JSON.parse(raw);
      } else {
        this.index = {};
      }

      // Read each entity file in entities directory
      if (fs.existsSync(this.dataDir)) {
        const files = fs.readdirSync(this.dataDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const entityType = file.replace('.json', '') as EntityType;
          const filePath = path.join(this.dataDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const records = JSON.parse(raw) as TelegramRecordEnvelope[];

          const typeMap = new Map<string, TelegramRecordEnvelope>();
          for (const rec of records) {
            typeMap.set(rec.id, rec);
          }
          this.store.set(entityType, typeMap);
        }
      }

      this.isLoaded = true;
    } catch (err) {
      console.warn('[TelegramCache] Cache read warning from disk (will rebuild):', err);
      this.store.clear();
      this.index = {};
      this.isLoaded = true;
    }
  }

  /**
   * Persists the current in-memory cache and index to disk atomically
   */
  public flushToDisk(targetType?: EntityType): void {
    try {
      this.initDirs();

      // Write index
      const tempIndexPath = `${this.indexPath}.${Date.now()}.tmp`;
      fs.writeFileSync(tempIndexPath, JSON.stringify(this.index, null, 2), 'utf-8');
      fs.renameSync(tempIndexPath, this.indexPath);

      // Write entity collections
      const typesToFlush = targetType ? [targetType] : Array.from(this.store.keys());
      for (const type of typesToFlush) {
        const typeMap = this.store.get(type);
        const records = typeMap ? Array.from(typeMap.values()) : [];
        const filePath = path.join(this.dataDir, `${type}.json`);
        const tempPath = `${filePath}.${Date.now()}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
        fs.renameSync(tempPath, filePath);
      }
    } catch (err) {
      console.warn('[TelegramCache] Disk flush warning (in-memory state preserved):', err);
    }
  }

  /**
   * Stores / Updates a record in cache
   */
  public setRecord(
    envelope: TelegramRecordEnvelope,
    messageId?: number,
    autoFlush: boolean = true
  ): void {
    if (!this.store.has(envelope.type)) {
      this.store.set(envelope.type, new Map());
    }

    const typeMap = this.store.get(envelope.type)!;
    typeMap.set(envelope.id, envelope);

    const entityKey = `${envelope.type}:${envelope.id}`;
    const existingIndex = this.index[entityKey];

    this.index[entityKey] = {
      type: envelope.type,
      id: envelope.id,
      version: envelope.version,
      messageId: messageId ?? existingIndex?.messageId ?? 0,
      updatedAt: envelope.updatedAt,
      isDeleted: Boolean(envelope.isDeleted),
      deletedAt: envelope.deletedAt ?? null
    };

    if (autoFlush) {
      this.flushToDisk(envelope.type);
    }
  }

  /**
   * Retrieves a single record by entity type and ID
   */
  public getRecord<T = any>(
    type: EntityType,
    id: string,
    includeDeleted: boolean = false
  ): TelegramRecordEnvelope<T> | null {
    const typeMap = this.store.get(type);
    if (!typeMap) return null;

    const envelope = typeMap.get(id);
    if (!envelope) return null;

    if (!includeDeleted && envelope.isDeleted) {
      return null;
    }

    return envelope as TelegramRecordEnvelope<T>;
  }

  /**
   * Retrieves all records of a given entity type
   */
  public getAllRecords<T = any>(
    type: EntityType,
    includeDeleted: boolean = false
  ): TelegramRecordEnvelope<T>[] {
    const typeMap = this.store.get(type);
    if (!typeMap) return [];

    const list = Array.from(typeMap.values());
    if (includeDeleted) return list as TelegramRecordEnvelope<T>[];
    return list.filter((r) => !r.isDeleted) as TelegramRecordEnvelope<T>[];
  }

  /**
   * Deletes a record from cache (soft or hard delete)
   */
  public deleteRecord(type: EntityType, id: string, hardDelete: boolean = false): void {
    const typeMap = this.store.get(type);
    if (!typeMap) return;

    if (hardDelete) {
      typeMap.delete(id);
      delete this.index[`${type}:${id}`];
    } else {
      const rec = typeMap.get(id);
      if (rec) {
        rec.isDeleted = true;
        rec.deletedAt = new Date().toISOString();
        this.setRecord(rec, undefined, false);
      }
    }
    this.flushToDisk(type);
  }

  /**
   * Retrieves index entry for entity
   */
  public getIndexEntry(type: EntityType, id: string): TelegramIndexEntry | null {
    return this.index[`${type}:${id}`] || null;
  }

  /**
   * Finds the latest message ID processed across all records
   */
  public getHighestMessageId(): number {
    let maxId = 0;
    for (const entry of Object.values(this.index)) {
      if (entry.messageId > maxId) {
        maxId = entry.messageId;
      }
    }
    return maxId;
  }

  /**
   * Clears in-memory cache and disk storage (for fresh sync or dev reset)
   */
  public clearAll(): void {
    this.store.clear();
    this.index = {};
    try {
      if (fs.existsSync(this.dataDir)) {
        const files = fs.readdirSync(this.dataDir);
        for (const f of files) {
          fs.unlinkSync(path.join(this.dataDir, f));
        }
      }
      if (fs.existsSync(this.indexPath)) {
        fs.unlinkSync(this.indexPath);
      }
    } catch (err) {
      console.warn('[TelegramCache] Cache clear notice:', err);
    }
  }
}

export const telegramCache = new TelegramCache();
