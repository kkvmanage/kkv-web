import { env } from '../config/env.js';
import { TelegramApiResponse, TelegramMessage, TelegramUpdate } from './telegram.types.js';

export class TelegramClient {
  private get botToken(): string {
    return (env.TELEGRAM_BOT_TOKEN || '').trim();
  }

  private get defaultChatId(): string {
    return (env.TELEGRAM_CHAT_ID || '').trim();
  }

  private get baseUrl(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken && this.defaultChatId);
  }

  /**
   * Generic safe Telegram API fetch with rate-limiting, exponential backoff, and retry logic
   */
  private async request<T>(
    endpoint: string,
    body?: any,
    options: { method?: string; isFormData?: boolean; maxRetries?: number } = {}
  ): Promise<TelegramApiResponse<T>> {
    if (!this.botToken) {
      return {
        ok: false,
        description: 'TELEGRAM_BOT_TOKEN is not configured in backend environment.'
      };
    }

    const method = options.method || (body ? 'POST' : 'GET');
    const maxRetries = options.maxRetries ?? 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const url = `${this.baseUrl}/${endpoint}`;
        const headers: Record<string, string> = {};
        let requestBody: any = undefined;

        if (body) {
          if (options.isFormData) {
            requestBody = body; // FormData handles its own boundary
          } else {
            headers['Content-Type'] = 'application/json';
            requestBody = JSON.stringify(body);
          }
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(url, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal
        });
        clearTimeout(timeout);

        const data = (await res.json()) as TelegramApiResponse<T>;

        if (res.status === 429 || data.parameters?.retry_after) {
          const waitSeconds = data.parameters?.retry_after || Math.min(2 ** attempt, 10);
          console.warn(`[TelegramClient] Rate limit encountered on /${endpoint}. Waiting ${waitSeconds}s before retry...`);
          await new Promise((r) => setTimeout(r, waitSeconds * 1000));
          continue;
        }

        if (!res.ok || !data.ok) {
          if (attempt >= maxRetries) {
            console.error(`[TelegramClient] Telegram API error on /${endpoint}: ${data.description || res.statusText}`);
            return data;
          }
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        return data;
      } catch (err: any) {
        if (attempt >= maxRetries) {
          console.error(`[TelegramClient] Network failure requesting /${endpoint}:`, err?.message || err);
          return {
            ok: false,
            description: `Telegram network error: ${err?.message || 'Connection failed'}`
          };
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    return {
      ok: false,
      description: 'Maximum retry attempts exceeded.'
    };
  }

  /**
   * Verifies bot credentials and connectivity with Telegram
   */
  public async getMe(): Promise<TelegramApiResponse<any>> {
    return this.request<any>('getMe');
  }

  /**
   * Verifies chat accessibility
   */
  public async getChat(chatId: string = this.defaultChatId): Promise<TelegramApiResponse<any>> {
    return this.request<any>('getChat', { chat_id: chatId });
  }

  /**
   * Sends a structured text message to the storage chat
   */
  public async sendMessage(
    text: string,
    chatId: string = this.defaultChatId,
    extra: { parse_mode?: string; disable_notification?: boolean } = {}
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.request<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      disable_notification: extra.disable_notification ?? true,
      ...(extra.parse_mode ? { parse_mode: extra.parse_mode } : {})
    });
  }

  /**
   * Edits an existing message text in-place (optimistic update strategy)
   */
  public async editMessageText(
    messageId: number,
    text: string,
    chatId: string = this.defaultChatId,
    extra: { parse_mode?: string } = {}
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.request<TelegramMessage>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...(extra.parse_mode ? { parse_mode: extra.parse_mode } : {})
    });
  }

  /**
   * Deletes a message from the storage chat (hard delete / cleanup)
   */
  public async deleteMessage(
    messageId: number,
    chatId: string = this.defaultChatId
  ): Promise<TelegramApiResponse<boolean>> {
    return this.request<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  /**
   * Uploads large payloads or backup archives as documents
   */
  public async sendDocument(
    fileBuffer: Buffer | Uint8Array,
    fileName: string,
    caption: string = '',
    chatId: string = this.defaultChatId
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    const blob = new Blob([fileBuffer]);
    formData.append('document', blob, fileName);
    if (caption) {
      formData.append('caption', caption);
    }

    return this.request<TelegramMessage>('sendDocument', formData, {
      isFormData: true
    });
  }

  /**
   * Polls updates / messages for synchronization
   */
  public async getUpdates(
    offset?: number,
    limit: number = 100
  ): Promise<TelegramApiResponse<TelegramUpdate[]>> {
    const params: any = { limit, allowed_updates: ['message', 'channel_post', 'edited_message', 'edited_channel_post'] };
    if (typeof offset === 'number') {
      params.offset = offset;
    }
    return this.request<TelegramUpdate[]>('getUpdates', params);
  }

  /**
   * Checks full connectivity status
   */
  public async checkHealth(): Promise<{
    configured: boolean;
    connected: boolean;
    botUsername?: string;
    chatTitle?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.'
      };
    }

    try {
      const meRes = await this.getMe();
      if (!meRes.ok || !meRes.result) {
        return {
          configured: true,
          connected: false,
          error: meRes.description || 'Failed to authenticate with Telegram Bot API.'
        };
      }

      const botUsername = meRes.result.username || meRes.result.first_name;

      const chatRes = await this.getChat();
      if (!chatRes.ok || !chatRes.result) {
        return {
          configured: true,
          connected: false,
          botUsername,
          error: chatRes.description || `Unable to access Telegram storage chat ID (${this.defaultChatId}). Ensure bot is an Admin with post/edit rights in the channel/group.`
        };
      }

      return {
        configured: true,
        connected: true,
        botUsername,
        chatTitle: chatRes.result.title || chatRes.result.first_name || 'Storage Channel'
      };
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        error: err?.message || 'Error checking Telegram health'
      };
    }
  }
}

export const telegramClient = new TelegramClient();
