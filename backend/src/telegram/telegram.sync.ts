import { telegramClient } from './telegram.client.js';
import { telegramCache } from './telegram.cache.js';
import { TelegramParser } from './telegram.parser.js';
import { TelegramMessage, TelegramUpdate } from './telegram.types.js';

export class TelegramSyncService {
  private isSyncing = false;
  private lastUpdateId: number = 0;
  private syncTimer: NodeJS.Timeout | null = null;

  /**
   * Processes an incoming raw Telegram message and ingests it into cache if valid
   */
  public ingestMessage(msg?: TelegramMessage): boolean {
    if (!msg) return false;

    const rawContent = msg.text || msg.caption;
    if (!rawContent) return false;

    const envelope = TelegramParser.parse(rawContent);
    if (!envelope) return false;

    const existing = telegramCache.getRecord(envelope.type, envelope.id, true);
    if (existing) {
      // Deterministically accept higher version or newer updatedAt
      if (envelope.version > existing.version) {
        telegramCache.setRecord(envelope, msg.message_id, true);
        return true;
      } else if (
        envelope.version === existing.version &&
        new Date(envelope.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()
      ) {
        telegramCache.setRecord(envelope, msg.message_id, true);
        return true;
      }
      return false;
    }

    telegramCache.setRecord(envelope, msg.message_id, true);
    return true;
  }

  public async syncFromTelegram(): Promise<any> {
    return this.syncUpdates();
  }

  /**
   * Pulls recent updates from Telegram Bot API and synchronizes the local cache
   */
  public async syncUpdates(): Promise<{ processed: number; success: boolean }> {
    if (this.isSyncing) {
      return { processed: 0, success: true };
    }

    if (!telegramClient.isConfigured()) {
      return { processed: 0, success: false };
    }

    this.isSyncing = true;
    let processedCount = 0;

    try {
      const updatesRes = await telegramClient.getUpdates(
        this.lastUpdateId ? this.lastUpdateId + 1 : undefined,
        100
      );

      if (updatesRes.ok && Array.isArray(updatesRes.result)) {
        for (const update of updatesRes.result) {
          if (update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
          }

          const targetMsg =
            update.message ||
            update.channel_post ||
            update.edited_message ||
            update.edited_channel_post;

          if (targetMsg) {
            const ingested = this.ingestMessage(targetMsg);
            if (ingested) processedCount++;
          }
        }
      }

      this.isSyncing = false;
      return { processed: processedCount, success: true };
    } catch (err) {
      this.isSyncing = false;
      console.warn('[TelegramSync] Background sync warning:', err);
      return { processed: processedCount, success: false };
    }
  }

  /**
   * Starts periodic background synchronization so multi-PC updates flow automatically
   */
  public startPeriodicSync(intervalMs: number = 15000): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Immediate initial sync
    this.syncUpdates().catch(() => {});

    this.syncTimer = setInterval(() => {
      this.syncUpdates().catch(() => {});
    }, intervalMs);

    console.log(`[TelegramSync] Multi-PC periodic sync started (interval: ${intervalMs / 1000}s)`);
  }

  /**
   * Stops periodic sync
   */
  public stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const telegramSyncService = new TelegramSyncService();
