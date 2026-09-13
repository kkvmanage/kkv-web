import { FDRenewal } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IFDRenewalDocument extends Omit<FDRenewal, 'id'> {
  id: string;
}

export class FDRenewalModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<FDRenewal>('FD_RENEWAL', { includeDeleted });

    if (query.oldFdId) {
      records = records.filter((r) => (r as any).oldFdId === query.oldFdId);
    }
    if (query.newFdId) {
      records = records.filter((r) => (r as any).newFdId === query.newFdId);
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
    return telegramRepository.countRecords('FD_RENEWAL', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['FD_RENEWAL']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || `FDRN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const res = await telegramRepository.createRecord('FD_RENEWAL', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default FDRenewalModel;
