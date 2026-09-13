import { telegramClient } from '../telegram/telegram.client.js';
import { backupService } from './backup.service.js';
import { adminService } from './admin.service.js';

export class TelegramService {
  public async sendTestMessage(): Promise<{ success: boolean; message: string }> {
    if (!telegramClient.isConfigured()) {
      return { success: false, message: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing from environment.' };
    }

    try {
      const res = await telegramClient.sendMessage(
        `⚙️ KKV Gold Finance - Telegram persistence layer test successful!\nTimestamp: ${new Date().toLocaleString()}`
      );

      if (!res.ok) {
        return { success: false, message: `Telegram Error: ${res.description || 'Failed to send'}` };
      }

      return { success: true, message: 'Test message sent successfully to Telegram storage channel.' };
    } catch (err: any) {
      return { success: false, message: `Connection Error: ${err.message}` };
    }
  }

  public async sendBackup(): Promise<{ success: boolean; message: string }> {
    if (!telegramClient.isConfigured()) {
      return { success: false, message: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.' };
    }

    try {
      const backupResult = backupService.exportBackup();
      const filename = `KKV_Gold_Finance_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      const buffer = Buffer.from(JSON.stringify(backupResult.data, null, 2), 'utf-8');
      const caption = `📦 KKV Gold Finance Branch Database Backup\nTimestamp: ${new Date().toLocaleString()}\nCustomers: ${backupResult.data.customers.length}\nLoans: ${backupResult.data.loans.length}\nFDs: ${backupResult.data.fixedDeposits.length}`;

      const res = await telegramClient.sendDocument(buffer, filename, caption);

      if (!res.ok) {
        return { success: false, message: `Telegram Error: ${res.description || 'Failed to send backup document'}` };
      }

      const dateStr = new Date().toLocaleString('en-GB');
      adminService.updateTelegramConfig({ lastBackupDate: dateStr });

      return { success: true, message: 'Database backup file dispatched to Telegram.' };
    } catch (err: any) {
      return { success: false, message: `Backup execution error: ${err.message}` };
    }
  }
}

export const telegramService = new TelegramService();
export default telegramService;
