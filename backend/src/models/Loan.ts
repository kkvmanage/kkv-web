import { Loan } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface ILoanDocument extends Omit<Loan, 'id'> {
  id: string;
}

export class LoanModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<Loan>('LOAN', { includeDeleted });

    if (query.customerId) {
      records = records.filter((l) => l.customerId === query.customerId);
    }
    if (query.loanNo) {
      records = records.filter((l) => l.loanNo === query.loanNo);
    }
    if (query.status) {
      records = records.filter((l) => (l as any).status === query.status);
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
    const records = telegramRepository.getRecords<Loan>('LOAN', { includeDeleted });

    let match: Loan | null = null;
    if (query.loanNo) {
      match = records.find((l) => l.loanNo === query.loanNo || l.id === query.loanNo) || null;
    } else if (query.id) {
      match = records.find((l) => l.id === query.id || l.loanNo === query.id) || null;
    } else if (query.$or && Array.isArray(query.$or)) {
      match = records.find((l) =>
        query.$or.some((clause: any) =>
          (clause.loanNo && (l.loanNo === clause.loanNo || l.id === clause.loanNo)) ||
          (clause.id && (l.id === clause.id || l.loanNo === clause.id)) ||
          (clause.customerId && l.customerId === clause.customerId)
        )
      ) || null;
    }

    const chain = {
      select: () => chain,
      lean: async () => match,
      then: (resolve: any, reject?: any) => Promise.resolve(match).then(resolve, reject)
    };
    return chain;
  }

  public static async findOneAndUpdate(query: any, update: any, _options: any = {}): Promise<any> {
    const doc = update.$set || update;
    const id = doc.id || doc.loanNo || query.id || query.loanNo;
    if (!id) return null;

    const existing = telegramRepository.getRecordById<Loan>('LOAN', id, true);
    if (existing) {
      const updated = await telegramRepository.updateRecord<Loan>('LOAN', id, doc);
      return updated.data;
    } else {
      const created = await telegramRepository.createRecord<Loan>('LOAN', id, doc);
      return created.data;
    }
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    return telegramRepository.countRecords('LOAN', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['LOAN']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || d.loanNo;
      const res = await telegramRepository.createRecord('LOAN', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default LoanModel;
