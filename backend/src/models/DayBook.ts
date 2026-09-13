import { DayBookEntry } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IDayBookDocument extends Omit<DayBookEntry, 'id'> {
  id: string;
}

export class DayBookModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<DayBookEntry>('DAYBOOK', { includeDeleted });

    if (query.date) {
      records = records.filter((r) => r.date === query.date);
    }
    if (query.branchId) {
      records = records.filter((r) => r.branchId === query.branchId);
    }

    const chain = {
      sort: () => chain,
      select: () => chain,
      lean: async () => records,
      then: (resolve: any, reject?: any) => Promise.resolve(records).then(resolve, reject)
    };
    return chain;
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    return telegramRepository.countRecords('DAYBOOK', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['DAYBOOK']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || `DB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const res = await telegramRepository.createRecord('DAYBOOK', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default DayBookModel;
