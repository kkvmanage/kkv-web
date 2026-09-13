import { FDCustomer } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IFDCustomerDocument extends Omit<FDCustomer, 'id'> {
  id: string;
}

export class FDCustomerModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<FDCustomer>('FD_CUSTOMER', { includeDeleted });

    if (query.phone) {
      records = records.filter((c) => c.phone === query.phone);
    }
    if (query.customerId) {
      records = records.filter((c) => c.customerId === query.customerId || c.id === query.customerId);
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
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    const records = telegramRepository.getRecords<FDCustomer>('FD_CUSTOMER', { includeDeleted });

    let match: FDCustomer | null = null;
    if (query.phone) {
      match = records.find((c) => c.phone === query.phone) || null;
    } else if (query.customerId) {
      match = records.find((c) => c.customerId === query.customerId || c.id === query.customerId) || null;
    } else if (query.id) {
      match = records.find((c) => c.id === query.id) || null;
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
    return telegramRepository.countRecords('FD_CUSTOMER', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['FD_CUSTOMER']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || `FDC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const res = await telegramRepository.createRecord('FD_CUSTOMER', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default FDCustomerModel;
