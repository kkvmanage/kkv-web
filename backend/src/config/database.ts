import { telegramClient } from '../telegram/telegram.client.js';
import { telegramSyncService } from '../telegram/telegram.sync.js';

/**
 * Verifies Telegram storage connectivity and starts multi-PC sync
 */
export async function connectDB(): Promise<boolean> {
  console.log('[Storage] Initializing Telegram Bot API persistent storage layer...');
  const health = await telegramClient.checkHealth();
  if (health.connected) {
    console.log(`[Storage] ✓ Telegram Bot API connected successfully (Bot: @${health.botUsername}, Chat: ${health.chatTitle})`);
    telegramSyncService.startPeriodicSync(15000);
    return true;
  } else {
    console.warn(`[Storage] ⚠️ Telegram Bot API connection notice: ${health.error || 'Check credentials'}`);
    telegramSyncService.startPeriodicSync(15000);
    return false;
  }
}

export function isTelegramStorageReady(): boolean {
  return true;
}

export function isStorageConnected(): boolean {
  return telegramClient.isConfigured();
}

export async function ensureStorageConnected(): Promise<boolean> {
  return telegramClient.isConfigured();
}

export async function checkStorageHealth(): Promise<{
  status: 'ok' | 'error';
  success: boolean;
  storage: 'telegram';
  telegram: 'connected' | 'disconnected';
  ready: boolean;
  botUsername?: string;
  chatTitle?: string;
  error?: string;
}> {
  const health = await telegramClient.checkHealth();
  return {
    status: health.connected ? 'ok' : 'error',
    success: health.connected,
    storage: 'telegram',
    telegram: health.connected ? 'connected' : 'disconnected',
    ready: health.connected,
    botUsername: health.botUsername,
    chatTitle: health.chatTitle,
    error: health.error
  };
}

// Aliases for compatibility
export const isMongoConnected = isStorageConnected;
export const ensureMongoConnected = ensureStorageConnected;
export const checkMongoHealth = checkStorageHealth;

export default {
  connectDB,
  isTelegramStorageReady,
  isStorageConnected,
  ensureStorageConnected,
  checkStorageHealth
};
