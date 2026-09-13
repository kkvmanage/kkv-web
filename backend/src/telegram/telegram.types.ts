export type EntityType =
  | 'CUSTOMER'
  | 'LOAN'
  | 'RECEIPT'
  | 'DAYBOOK'
  | 'FIXED_DEPOSIT'
  | 'FD_CUSTOMER'
  | 'FD_INTEREST_PAYOUT'
  | 'FD_WITHDRAWAL'
  | 'FD_RENEWAL'
  | 'FILE_ATTACHMENT'
  | 'RENTAL_COMPLEX'
  | 'RENTAL_SHOP'
  | 'RENTAL_PAYMENT'
  | 'RENTAL_EXPENSE'
  | 'RENTAL_AUDIT'
  | 'RENTAL_DAYBOOK'
  | 'USER'
  | 'SETTINGS'
  | 'AUDIT'
  | 'COUNTER';

export const APP_RECORD_MARKER = 'KKV_APP_RECORD';

export interface TelegramRecordEnvelope<T = any> {
  app: 'KKV_GOLD_FINANCE';
  marker: typeof APP_RECORD_MARKER;
  type: EntityType;
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  actor?: {
    uid?: string;
    email?: string;
    role?: string;
  };
  data: T;
}

export interface TelegramIndexEntry {
  type: EntityType;
  id: string;
  version: number;
  messageId: number;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
}

export interface TelegramIndexMap {
  [entityKey: string]: TelegramIndexEntry; // key: `${type}:${id}`
}

export interface TelegramCacheState {
  version: number;
  lastSyncTimestamp: string;
  lastMessageIdProcessed: number;
  totalRecords: number;
}

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: {
    id: number | string;
    title?: string;
    type: string;
  };
  text?: string;
  caption?: string;
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}
