import { telegramRepository } from '../telegram/telegram.repository.js';
import { counterService } from './counter.service.js';
import { Receipt } from '../types/index.js';

export class ReceiptService {
  public async getAllAsync(): Promise<Receipt[]> {
    return this.getAll();
  }

  public getAll(): Receipt[] {
    const list = telegramRepository.getRecords<Receipt>('RECEIPT');
    return list.sort((a, b) => (b.receiptNo || 0) - (a.receiptNo || 0));
  }

  public async getByIdAsync(id: string): Promise<Receipt | null> {
    return this.getById(id);
  }

  public getById(id: string): Receipt | null {
    const receipts = this.getAll();
    return receipts.find((r) => r.id === id || `RCPT-${r.receiptNo}` === id) || null;
  }

  public async getByReceiptNoAsync(receiptNo: number): Promise<Receipt | null> {
    return this.getByReceiptNo(receiptNo);
  }

  public getByReceiptNo(receiptNo: number): Receipt | null {
    const receipts = this.getAll();
    return receipts.find((r) => r.receiptNo === receiptNo) || null;
  }

  public async create(receiptData: Omit<Receipt, 'id'> & { receiptNo?: number }, actor?: any): Promise<Receipt> {
    let receiptNo = receiptData.receiptNo;
    if (!receiptNo || receiptNo <= 0) {
      receiptNo = await counterService.getNextSequence('receiptNo');
    }

    const id = `RCPT-${receiptNo}`;
    const newReceipt: Receipt = {
      ...receiptData,
      id,
      receiptNo,
      createdAt: new Date().toISOString()
    };

    await telegramRepository.createRecord('RECEIPT', id, newReceipt, actor);

    return newReceipt;
  }
}

export const receiptService = new ReceiptService();
export default receiptService;
