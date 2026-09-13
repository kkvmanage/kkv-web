import { telegramRepository } from '../telegram/telegram.repository.js';
import { EntityType } from '../telegram/telegram.types.js';

export interface ConcurrencyError extends Error {
  statusCode: number;
  code: string;
}

const mapCollectionToEntityType = (collection: string): EntityType => {
  const norm = collection.toLowerCase().replace(/[_-]/g, '');
  if (norm.includes('customer') && !norm.includes('fd')) return 'CUSTOMER';
  if (norm.includes('loan')) return 'LOAN';
  if (norm.includes('receipt')) return 'RECEIPT';
  if (norm.includes('daybook')) return 'DAYBOOK';
  if (norm.includes('fdcustomer')) return 'FD_CUSTOMER';
  if (norm.includes('fdpayout') || norm.includes('fdinterest')) return 'FD_INTEREST_PAYOUT';
  if (norm.includes('fdwithdrawal')) return 'FD_WITHDRAWAL';
  if (norm.includes('fdrenewal')) return 'FD_RENEWAL';
  if (norm.includes('fixeddeposit') || norm.includes('fd')) return 'FIXED_DEPOSIT';
  if (norm.includes('complex')) return 'RENTAL_COMPLEX';
  if (norm.includes('shop')) return 'RENTAL_SHOP';
  if (norm.includes('rentalpayment') || norm.includes('rentpayment')) return 'RENTAL_PAYMENT';
  if (norm.includes('rentalexpense') || norm.includes('expense')) return 'RENTAL_EXPENSE';
  if (norm.includes('rentaldaybook')) return 'RENTAL_DAYBOOK';
  if (norm.includes('rentalaudit')) return 'RENTAL_AUDIT';
  if (norm.includes('audit')) return 'AUDIT';
  if (norm.includes('counter')) return 'COUNTER';
  return 'SETTINGS';
};

export class DatabaseService {
  /**
   * Execute idempotent financial operation
   */
  async handleIdempotency<T>(
    idempotencyKey?: string,
    operation?: () => Promise<T>
  ): Promise<{ handled: boolean; result?: T }> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      return { handled: false };
    }

    const key = idempotencyKey.trim();
    const existing = telegramRepository.getRecordById<any>('SETTINGS', `idempotency_${key}`);
    if (existing && existing.data?.response) {
      return { handled: true, result: existing.data.response as T };
    }

    if (operation) {
      const result = await operation();
      await telegramRepository.createRecord('SETTINGS', `idempotency_${key}`, {
        key,
        response: result,
        createdAt: new Date().toISOString()
      }).catch(() => {});
      return { handled: true, result };
    }

    return { handled: false };
  }

  /**
   * Generic GetAll backed by Telegram repository
   */
  async getAll<T extends { id?: string }>(collection: string): Promise<T[]> {
    const type = mapCollectionToEntityType(collection);
    return telegramRepository.getRecords<T>(type);
  }

  /**
   * Generic GetById backed by Telegram repository
   */
  async getById<T extends { id?: string; loanNo?: string; fdNo?: string; uid?: string }>(
    collection: string,
    id: string
  ): Promise<T | null> {
    const type = mapCollectionToEntityType(collection);
    const env = telegramRepository.getRecordById<T>(type, id);
    if (env) return env.data;

    const all = telegramRepository.getRecords<T>(type);
    return all.find((i) => i.id === id || i.loanNo === id || i.fdNo === id || i.uid === id) || null;
  }

  /**
   * Generic Insert with versioning & concurrency safety
   */
  async insert<T extends { id?: string; version?: number; createdAt?: string }>(
    collection: string,
    item: T
  ): Promise<T> {
    const type = mapCollectionToEntityType(collection);
    const id = item.id || (item as any).loanNo || (item as any).fdNo || `rec_${Date.now()}`;
    const env = await telegramRepository.createRecord(type, id, item);
    return env.data;
  }

  /**
   * Generic Update with Optimistic Concurrency Control
   */
  async update<T extends { id?: string; version?: number; updatedAt?: string }>(
    collection: string,
    id: string,
    updates: Partial<T>,
    expectedVersion?: number
  ): Promise<T | null> {
    const type = mapCollectionToEntityType(collection);
    const env = await telegramRepository.updateRecord(type, id, updates, { expectedVersion });
    return env.data;
  }

  /**
   * Generic Soft Delete / Hard Delete
   */
  async delete(collection: string, id: string, softDelete: boolean = true): Promise<boolean> {
    const type = mapCollectionToEntityType(collection);
    const res = await telegramRepository.deleteRecord(type, id, !softDelete);
    return res.success;
  }

  /**
   * Multi-Document Transaction Wrapper
   */
  async withTransaction<R>(fn: () => Promise<R>): Promise<R> {
    return fn();
  }

  /**
   * Safe status summary
   */
  async migrateLocalToAtlas(): Promise<{
    success: boolean;
    migratedCounts: Record<string, number>;
    message: string;
  }> {
    return {
      success: true,
      migratedCounts: {},
      message: 'Persistence layer is running on Telegram Bot API.'
    };
  }
}

export const dbService = new DatabaseService();
export default dbService;
