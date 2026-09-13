import {
  EntityType,
  TelegramRecordEnvelope
} from './telegram.types.js';
import { telegramClient } from './telegram.client.js';
import { telegramCache } from './telegram.cache.js';
import { TelegramParser } from './telegram.parser.js';
import { telegramSyncService } from './telegram.sync.js';

export interface RepositoryQueryOptions<T = any> {
  includeDeleted?: boolean;
  filter?: (item: T, envelope: TelegramRecordEnvelope<T>) => boolean;
  sort?: (a: T, b: T) => number;
  limit?: number;
  skip?: number;
}

export class TelegramRepository {
  /**
   * Creates a new record, sends structured envelope to Telegram, and registers in cache
   */
  public async createRecord<T = any>(
    type: EntityType,
    id: string,
    data: T,
    actor?: { uid?: string; email?: string; role?: string }
  ): Promise<TelegramRecordEnvelope<T>> {
    // Check if non-deleted record with same ID already exists in cache
    const existing = telegramCache.getRecord<T>(type, id, true);
    if (existing && !existing.isDeleted) {
      const err: any = new Error(`Record with ID ${id} already exists for entity ${type}.`);
      err.statusCode = 409;
      err.code = 'DUPLICATE_RECORD';
      throw err;
    }

    const version = existing ? existing.version + 1 : 1;
    const envelope = TelegramParser.createEnvelope<T>(type, id, data, {
      version,
      actor
    });

    const serialized = TelegramParser.serialize(envelope);

    let messageId = 0;
    if (telegramClient.isConfigured()) {
      try {
        const sendRes = await telegramClient.sendMessage(serialized);
        if (sendRes.ok && sendRes.result?.message_id) {
          messageId = sendRes.result.message_id;
        } else {
          console.warn(`[TelegramRepository] Warning sending ${type}:${id} to Telegram: ${sendRes.description || 'Unknown'}`);
        }
      } catch (err: any) {
        console.warn(`[TelegramRepository] Network error sending ${type}:${id} to Telegram:`, err?.message || err);
      }
    }

    telegramCache.setRecord(envelope, messageId, true);
    return envelope;
  }

  /**
   * Retrieves a single record by entity type and application ID
   */
  public getRecordById<T = any>(
    type: EntityType,
    id: string,
    includeDeleted: boolean = false
  ): TelegramRecordEnvelope<T> | null {
    if (!id) return null;
    return telegramCache.getRecord<T>(type, id, includeDeleted);
  }

  /**
   * Retrieves all records with optional filtering, sorting, pagination
   */
  public getRecords<T = any>(
    type: EntityType,
    options: RepositoryQueryOptions<T> = {}
  ): T[] {
    const envelopes = telegramCache.getAllRecords<T>(type, options.includeDeleted ?? false);

    let items: { envelope: TelegramRecordEnvelope<T>; data: T }[] = envelopes.map((env) => ({
      envelope: env,
      data: env.data
    }));

    if (options.filter) {
      items = items.filter((i) => options.filter!(i.data, i.envelope));
    }

    if (options.sort) {
      items.sort((a, b) => options.sort!(a.data, b.data));
    }

    if (typeof options.skip === 'number' && options.skip > 0) {
      items = items.slice(options.skip);
    }

    if (typeof options.limit === 'number' && options.limit > 0) {
      items = items.slice(0, options.limit);
    }

    return items.map((i) => i.data);
  }

  /**
   * Retrieves full envelopes with metadata
   */
  public getRecordEnvelopes<T = any>(
    type: EntityType,
    options: RepositoryQueryOptions<T> = {}
  ): TelegramRecordEnvelope<T>[] {
    let envelopes = telegramCache.getAllRecords<T>(type, options.includeDeleted ?? false);

    if (options.filter) {
      envelopes = envelopes.filter((env) => options.filter!(env.data, env));
    }

    if (options.sort) {
      envelopes.sort((a, b) => options.sort!(a.data, b.data));
    }

    if (typeof options.skip === 'number' && options.skip > 0) {
      envelopes = envelopes.slice(options.skip);
    }

    if (typeof options.limit === 'number' && options.limit > 0) {
      envelopes = envelopes.slice(0, options.limit);
    }

    return envelopes;
  }

  /**
   * Finds records matching a custom predicate
   */
  public findRecords<T = any>(
    type: EntityType,
    predicate: (item: T, envelope: TelegramRecordEnvelope<T>) => boolean,
    includeDeleted: boolean = false
  ): T[] {
    const envelopes = telegramCache.getAllRecords<T>(type, includeDeleted);
    return envelopes.filter((env) => predicate(env.data, env)).map((env) => env.data);
  }

  /**
   * Counts records of a given entity type
   */
  public countRecords(
    type: EntityType,
    filter?: (item: any) => boolean,
    includeDeleted: boolean = false
  ): number {
    const envelopes = telegramCache.getAllRecords(type, includeDeleted);
    if (!filter) return envelopes.length;
    return envelopes.filter((env) => filter(env.data)).length;
  }

  /**
   * Updates an existing record with optimistic concurrency protection
   */
  public async updateRecord<T = any>(
    type: EntityType,
    id: string,
    data: Partial<T> | T,
    options: {
      expectedVersion?: number;
      actor?: { uid?: string; email?: string; role?: string };
    } = {}
  ): Promise<TelegramRecordEnvelope<T>> {
    const existing = telegramCache.getRecord<T>(type, id, true);
    if (!existing) {
      const err: any = new Error(`Record with ID "${id}" of type "${type}" not found.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Concurrency Protection: Check version if expectedVersion provided
    if (typeof options.expectedVersion === 'number' && existing.version !== options.expectedVersion) {
      const err: any = new Error(
        `Concurrency Conflict: Record was modified by another user (current version: ${existing.version}, expected: ${options.expectedVersion}). Please refresh and retry.`
      );
      err.statusCode = 409;
      err.code = 'CONCURRENCY_CONFLICT';
      throw err;
    }

    const updatedData: T = {
      ...(existing.data || {}),
      ...(data as any)
    };

    const nextVersion = existing.version + 1;
    const envelope = TelegramParser.createEnvelope<T>(type, id, updatedData, {
      version: nextVersion,
      createdAt: existing.createdAt,
      actor: options.actor
    });

    const serialized = TelegramParser.serialize(envelope);
    const indexEntry = telegramCache.getIndexEntry(type, id);

    let messageId = indexEntry?.messageId || 0;

    if (telegramClient.isConfigured()) {
      try {
        if (messageId > 0) {
          // Attempt in-place Telegram message edit
          const editRes = await telegramClient.editMessageText(messageId, serialized);
          if (!editRes.ok) {
            // Fallback: send new message and update messageId
            const sendRes = await telegramClient.sendMessage(serialized);
            if (sendRes.ok && sendRes.result?.message_id) {
              messageId = sendRes.result.message_id;
            }
          }
        } else {
          const sendRes = await telegramClient.sendMessage(serialized);
          if (sendRes.ok && sendRes.result?.message_id) {
            messageId = sendRes.result.message_id;
          }
        }
      } catch (err: any) {
        console.warn(`[TelegramRepository] Notice updating ${type}:${id} in Telegram:`, err?.message || err);
      }
    }

    telegramCache.setRecord(envelope, messageId, true);
    return envelope;
  }

  /**
   * Deletes a record (logical soft-delete by default, or hard delete if specified)
   */
  public async deleteRecord(
    type: EntityType,
    id: string,
    hardDelete: boolean = false,
    actor?: { uid?: string; email?: string; role?: string }
  ): Promise<{ success: boolean; message: string }> {
    const existing = telegramCache.getRecord(type, id, true);
    if (!existing) {
      return { success: false, message: 'Record not found' };
    }

    const indexEntry = telegramCache.getIndexEntry(type, id);
    const messageId = indexEntry?.messageId || 0;

    if (hardDelete) {
      if (telegramClient.isConfigured() && messageId > 0) {
        try {
          await telegramClient.deleteMessage(messageId);
        } catch (err) {
          console.warn(`[TelegramRepository] Hard delete message warning for ${type}:${id}:`, err);
        }
      }

      // Hard removal from cache & index
      const envelopes = telegramCache.getAllRecords(type, true);
      const filtered = envelopes.filter((e) => e.id !== id);
      const typeMap = new Map<string, TelegramRecordEnvelope>();
      for (const e of filtered) {
        typeMap.set(e.id, e);
      }
      (telegramCache as any).store.set(type, typeMap);
      delete (telegramCache as any).index[`${type}:${id}`];
      telegramCache.flushToDisk(type);

      return { success: true, message: `Record ${id} permanently deleted` };
    }

    // Soft delete: Increment version, set isDeleted: true, and persist
    const nextVersion = existing.version + 1;
    const envelope = TelegramParser.createEnvelope(type, id, existing.data, {
      version: nextVersion,
      createdAt: existing.createdAt,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: actor?.role || actor?.email || 'SYSTEM',
      actor
    });

    const serialized = TelegramParser.serialize(envelope);

    if (telegramClient.isConfigured()) {
      try {
        if (messageId > 0) {
          const editRes = await telegramClient.editMessageText(messageId, serialized);
          if (!editRes.ok) {
            await telegramClient.sendMessage(serialized);
          }
        } else {
          await telegramClient.sendMessage(serialized);
        }
      } catch (err: any) {
        console.warn(`[TelegramRepository] Soft delete notice for ${type}:${id}:`, err?.message || err);
      }
    }

    telegramCache.setRecord(envelope, messageId, true);
    return { success: true, message: `Record ${id} soft-deleted successfully` };
  }

  /**
   * Restores a soft-deleted record
   */
  public async restoreRecord<T = any>(
    type: EntityType,
    id: string,
    actor?: { uid?: string; email?: string; role?: string }
  ): Promise<TelegramRecordEnvelope<T> | null> {
    const existing = telegramCache.getRecord<T>(type, id, true);
    if (!existing || !existing.isDeleted) return null;

    const nextVersion = existing.version + 1;
    const envelope = TelegramParser.createEnvelope<T>(type, id, existing.data, {
      version: nextVersion,
      createdAt: existing.createdAt,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      actor
    });

    const serialized = TelegramParser.serialize(envelope);
    const indexEntry = telegramCache.getIndexEntry(type, id);
    const messageId = indexEntry?.messageId || 0;

    if (telegramClient.isConfigured()) {
      try {
        if (messageId > 0) {
          const editRes = await telegramClient.editMessageText(messageId, serialized);
          if (!editRes.ok) {
            await telegramClient.sendMessage(serialized);
          }
        } else {
          await telegramClient.sendMessage(serialized);
        }
      } catch (err: any) {
        console.warn(`[TelegramRepository] Restore record notice for ${type}:${id}:`, err?.message || err);
      }
    }

    telegramCache.setRecord(envelope, messageId, true);
    return envelope;
  }

  /**
   * Safe Reset: Clears application records from Telegram storage and local cache without touching unrelated messages
   */
  public async resetApplicationData(entityTypes?: EntityType[]): Promise<{ cleared: number; success: boolean }> {
    let clearedCount = 0;
    const typesToReset: EntityType[] = entityTypes || [
      'CUSTOMER',
      'LOAN',
      'RECEIPT',
      'DAYBOOK',
      'FIXED_DEPOSIT',
      'FD_CUSTOMER',
      'FD_INTEREST_PAYOUT',
      'FD_WITHDRAWAL',
      'FD_RENEWAL',
      'FILE_ATTACHMENT',
      'RENTAL_COMPLEX',
      'RENTAL_SHOP',
      'RENTAL_PAYMENT',
      'RENTAL_EXPENSE',
      'RENTAL_AUDIT',
      'RENTAL_DAYBOOK',
      'AUDIT'
    ];

    for (const type of typesToReset) {
      const records = telegramCache.getAllRecords(type, true);
      for (const rec of records) {
        const indexEntry = telegramCache.getIndexEntry(type, rec.id);
        if (indexEntry?.messageId && telegramClient.isConfigured()) {
          try {
            await telegramClient.deleteMessage(indexEntry.messageId);
          } catch (err) {
            // Ignore message deletion errors during bulk wipe
          }
        }
        clearedCount++;
      }
    }

    if (!entityTypes) {
      telegramCache.clearAll();
    } else {
      for (const t of typesToReset) {
        (telegramCache as any).store.delete(t);
        telegramCache.flushToDisk(t);
      }
    }

    return { cleared: clearedCount, success: true };
  }

  public async initialize(): Promise<void> {
    await telegramSyncService.syncFromTelegram();
  }
}

export const telegramRepository = new TelegramRepository();
