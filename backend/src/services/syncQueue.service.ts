import { localFileRepository } from '../repositories/localFile.repository.js';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncEntityType =
  | 'customer'
  | 'loan'
  | 'receipt'
  | 'fixed_deposit'
  | 'fd_customer'
  | 'fd_interest_payout'
  | 'fd_withdrawal'
  | 'fd_renewal'
  | 'daybook'
  | 'reminder'
  | 'notification'
  | 'settings';

export type SyncEventStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'RETRYING';

export interface SyncEvent {
  eventId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  version: number;
  timestamp: string;
  payload: any;
  status: SyncEventStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  error?: string;
  syncedAt?: string;
}

export interface SyncStatusSummary {
  totalEvents: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  retrying: number;
  isProcessing: boolean;
  lastProcessedAt?: string;
  recentEvents: SyncEvent[];
}

const OUTBOX_FILE = 'sync_outbox.json';
const MAX_OUTBOX_HISTORY = 500;

export class SyncQueueService {
  private isProcessing = false;
  private lastProcessedAt?: string;

  public enqueue(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload: any,
    version: number = 1
  ): SyncEvent {
    const timestamp = new Date().toISOString();
    const eventId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const event: SyncEvent = {
      eventId,
      entityType,
      entityId,
      operation,
      version,
      timestamp,
      payload,
      status: 'SYNCED',
      retryCount: 0,
      maxRetries: 5,
      syncedAt: timestamp
    };

    const outbox = this.getOutboxEvents();
    outbox.unshift(event);
    this.saveOutboxEvents(outbox);

    return event;
  }

  public getOutboxEvents(): SyncEvent[] {
    return localFileRepository.readJson<SyncEvent[]>(OUTBOX_FILE, []);
  }

  private saveOutboxEvents(events: SyncEvent[]): void {
    localFileRepository.writeJson(OUTBOX_FILE, events.slice(0, MAX_OUTBOX_HISTORY));
  }

  public async processQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const events = this.getOutboxEvents();
    const pending = events.filter(e => e.status === 'PENDING');
    for (const e of pending) {
      e.status = 'SYNCED';
      e.syncedAt = new Date().toISOString();
    }
    this.saveOutboxEvents(events);
    return { processed: pending.length, succeeded: pending.length, failed: 0 };
  }

  public async retryPendingEvents(): Promise<{ queued: number; message: string }> {
    return {
      queued: 0,
      message: 'All events synchronized locally.'
    };
  }

  public getSyncStatus(): SyncStatusSummary {
    const events = this.getOutboxEvents();
    const synced = events.filter((e) => e.status === 'SYNCED').length;

    return {
      totalEvents: events.length,
      pending: 0,
      syncing: 0,
      synced,
      failed: 0,
      retrying: 0,
      isProcessing: false,
      lastProcessedAt: this.lastProcessedAt || new Date().toISOString(),
      recentEvents: events.slice(0, 20)
    };
  }
}

export const syncQueueService = new SyncQueueService();
export default syncQueueService;
