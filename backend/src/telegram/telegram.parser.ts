import {
  APP_RECORD_MARKER,
  EntityType,
  TelegramRecordEnvelope
} from './telegram.types.js';

export class TelegramParser {
  /**
   * Serializes a record envelope into a deterministic Telegram text message
   */
  public static serialize<T = any>(envelope: TelegramRecordEnvelope<T>): string {
    const jsonStr = JSON.stringify(envelope, null, 2);
    return `${APP_RECORD_MARKER}\n${jsonStr}`;
  }

  /**
   * Parses a raw Telegram message text or caption into a verified TelegramRecordEnvelope
   */
  public static parse<T = any>(rawText?: string): TelegramRecordEnvelope<T> | null {
    if (!rawText || typeof rawText !== 'string') return null;

    const trimmed = rawText.trim();
    if (!trimmed.startsWith(APP_RECORD_MARKER)) {
      // Not an application record message
      return null;
    }

    try {
      // Strip marker and any leading/trailing whitespace
      const jsonStr = trimmed.slice(APP_RECORD_MARKER.length).trim();
      const parsed = JSON.parse(jsonStr) as TelegramRecordEnvelope<T>;

      if (
        parsed &&
        parsed.app === 'KKV_GOLD_FINANCE' &&
        parsed.type &&
        parsed.id &&
        typeof parsed.version === 'number' &&
        parsed.data !== undefined
      ) {
        return parsed;
      }
    } catch (err) {
      console.warn('[TelegramParser] Error parsing Telegram message JSON:', err);
    }

    return null;
  }

  /**
   * Builds a fresh envelope ready for sending
   */
  public static createEnvelope<T>(
    type: EntityType,
    id: string,
    data: T,
    options: {
      version?: number;
      createdAt?: string;
      isDeleted?: boolean;
      deletedAt?: string | null;
      deletedBy?: string | null;
      actor?: { uid?: string; email?: string; role?: string };
    } = {}
  ): TelegramRecordEnvelope<T> {
    const now = new Date().toISOString();
    return {
      app: 'KKV_GOLD_FINANCE',
      marker: APP_RECORD_MARKER,
      type,
      id,
      version: options.version ?? 1,
      createdAt: options.createdAt || now,
      updatedAt: now,
      isDeleted: options.isDeleted ?? false,
      deletedAt: options.deletedAt ?? null,
      deletedBy: options.deletedBy ?? null,
      actor: options.actor,
      data
    };
  }
}
