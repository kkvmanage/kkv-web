import { FixedDeposit } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IFixedDepositDocument extends Omit<FixedDeposit, 'id'> {
  id: string;
}

export class FixedDepositModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<FixedDeposit>('FIXED_DEPOSIT', { includeDeleted });

    if (query.customerId) {
      records = records.filter((f) => f.customerId === query.customerId);
    }
    if (query.status) {
      records = records.filter((f) => f.status === query.status);
    }
    if (query.fdNo) {
      records = records.filter((f) => f.fdNo === query.fdNo);
    }

    const chain = {
      sort: () => chain,
      select: () => chain,
      lean: async () => records,
      then: (resolve: any, reject?: any) => Promise.resolve(records).then(resolve, reject)
    };
    return chain;
  }

  public static findOne(query: any = {}): any {
    const records = telegramRepository.getRecords<FixedDeposit>('FIXED_DEPOSIT');
    let match: FixedDeposit | null = null;
    if (query.fdNo) {
      match = records.find((f) => f.fdNo === query.fdNo || f.id === query.fdNo) || null;
    } else if (query.id) {
      match = records.find((f) => f.id === query.id || f.fdNo === query.id) || null;
    }

    const chain = {
      select: () => chain,
      lean: async () => match,
      then: (resolve: any, reject?: any) => Promise.resolve(match).then(resolve, reject)
    };
    return chain;
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    return telegramRepository.countRecords('FIXED_DEPOSIT', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['FIXED_DEPOSIT']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || d.fdNo;
      const res = await telegramRepository.createRecord('FIXED_DEPOSIT', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default FixedDepositModel;
