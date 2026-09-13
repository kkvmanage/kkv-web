import { FDWithdrawal } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IFDWithdrawalDocument extends Omit<FDWithdrawal, 'id'> {
  id: string;
}

export class FDWithdrawalModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<FDWithdrawal>('FD_WITHDRAWAL', { includeDeleted });

    if (query.fdId) {
      records = records.filter((w) => w.fdId === query.fdId);
    }
    if (query.fdNo) {
      records = records.filter((w) => w.fdNo === query.fdNo);
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
    return telegramRepository.countRecords('FD_WITHDRAWAL', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['FD_WITHDRAWAL']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || `FDWD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const res = await telegramRepository.createRecord('FD_WITHDRAWAL', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default FDWithdrawalModel;
