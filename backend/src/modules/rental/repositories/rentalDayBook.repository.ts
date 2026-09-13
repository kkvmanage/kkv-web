import { RentalDayBookEntry } from '../types/rental.types.js';
import { telegramRepository } from '../../../telegram/telegram.repository.js';

export class RentalDayBookRepository {
  public clearCache(): void {}

  public writeJson(_fileName: string, _data: any): void {
    // Compatibility method for reset/wipe scripts
  }

  public readJson<T = any>(_fileName: string, fallback: T): T {
    return fallback;
  }

  public async getManualEntries(): Promise<RentalDayBookEntry[]> {
    return telegramRepository.getRecords<RentalDayBookEntry>('RENTAL_DAYBOOK');
  }

  public async saveManualEntry(entry: RentalDayBookEntry): Promise<RentalDayBookEntry> {
    const id = entry.id || `RDB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const record = { ...entry, id };

    const existing = telegramRepository.getRecordById('RENTAL_DAYBOOK', id);
    if (existing) {
      await telegramRepository.updateRecord('RENTAL_DAYBOOK', id, record);
    } else {
      await telegramRepository.createRecord('RENTAL_DAYBOOK', id, record);
    }

    return record;
  }

  public async setEntries(entries: RentalDayBookEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.saveManualEntry(entry);
    }
  }
}

export const rentalDayBookRepository = new RentalDayBookRepository();
export default rentalDayBookRepository;
