import { FDInterestPayout } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IFDInterestPayoutDocument extends Omit<FDInterestPayout, 'id'> {
  id: string;
}

export class FDInterestPayoutModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<FDInterestPayout>('FD_INTEREST_PAYOUT', { includeDeleted });

    if (query.fdId) {
      records = records.filter((p) => (p as any).fdId === query.fdId);
    }
    if (query.fdNo) {
      records = records.filter((p) => p.fdNo === query.fdNo);
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
    return telegramRepository.countRecords('FD_INTEREST_PAYOUT', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['FD_INTEREST_PAYOUT']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || `FDPO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const res = await telegramRepository.createRecord('FD_INTEREST_PAYOUT', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default FDInterestPayoutModel;
