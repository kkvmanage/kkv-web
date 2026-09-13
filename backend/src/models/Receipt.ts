import { Receipt } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IReceiptDocument extends Omit<Receipt, 'id'> {
  id: string;
}

export class ReceiptModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<Receipt>('RECEIPT', { includeDeleted });

    if (query.customerId) {
      records = records.filter((r) => r.customerId === query.customerId);
    }
    if (query.loanNo) {
      records = records.filter((r) => r.loanNo === query.loanNo);
    }
    if (query.loanId) {
      records = records.filter((r) => r.loanId === query.loanId);
    }
    if (query.receiptNo) {
      records = records.filter((r) => r.receiptNo === query.receiptNo);
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
    const records = telegramRepository.getRecords<Receipt>('RECEIPT');
    let match: Receipt | null = null;
    if (query.id) {
      match = records.find((r) => r.id === query.id || `RCPT-${r.receiptNo}` === query.id) || null;
    } else if (query.receiptNo) {
      match = records.find((r) => r.receiptNo === query.receiptNo) || null;
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
    const id = doc.id || (doc.receiptNo ? `RCPT-${doc.receiptNo}` : query.id);
    if (!id) return null;

    const existing = telegramRepository.getRecordById<Receipt>('RECEIPT', id, true);
    if (existing) {
      const updated = await telegramRepository.updateRecord<Receipt>('RECEIPT', id, doc);
      return updated.data;
    } else {
      const created = await telegramRepository.createRecord<Receipt>('RECEIPT', id, doc);
      return created.data;
    }
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    return telegramRepository.countRecords('RECEIPT', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['RECEIPT']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.id || `RCPT-${d.receiptNo}`;
      const res = await telegramRepository.createRecord('RECEIPT', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default ReceiptModel;
