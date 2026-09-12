import { googleDriveRepository } from '../repositories/googleDrive.repository.js';
import { syncQueueService } from './syncQueue.service.js';
import { counterService } from './counter.service.js';
import { Receipt } from '../types/index.js';
import { ReceiptModel } from '../models/Receipt.js';
import { isMongoConnected, ensureMongoConnected } from '../config/database.js';

const FILE_NAME = 'receipts.json';
const initialReceipts: Receipt[] = [];

export class ReceiptService {
  public async getAllAsync(): Promise<Receipt[]> {
    try {
      if (isMongoConnected()) {
        const dbReceipts = await ReceiptModel.find()
          .sort({ receiptNo: -1 })
          .lean();
        const mapped: Receipt[] = (dbReceipts || []).map((r: any) => ({
          ...r,
          id: r.id || r._id?.toString()
        }));
        googleDriveRepository.writeJson(FILE_NAME, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[ReceiptService] MongoDB read failed, falling back to local file:', err);
    }

    let list = googleDriveRepository.readJson<Receipt[]>(FILE_NAME, initialReceipts);
    return Array.isArray(list) ? list : [];
  }

  public getAll(): Receipt[] {
    const list = googleDriveRepository.readJson<Receipt[]>(FILE_NAME, initialReceipts);
    return Array.isArray(list) ? list : [];
  }

  public async getByIdAsync(id: string): Promise<Receipt | null> {
    try {
      if (isMongoConnected()) {
        const dbReceipt = await ReceiptModel.findOne({ id }).lean();
        if (dbReceipt) {
          return { ...(dbReceipt as any), id: (dbReceipt as any).id || (dbReceipt as any)._id?.toString() };
        }
        return null;
      }
    } catch (err) {
      console.warn('[ReceiptService] getByIdAsync error:', err);
    }
    return this.getById(id);
  }

  public getById(id: string): Receipt | null {
    const receipts = this.getAll();
    return receipts.find((r) => r.id === id) || null;
  }

  public async getByReceiptNoAsync(receiptNo: number): Promise<Receipt | null> {
    try {
      if (isMongoConnected()) {
        const dbReceipt = await ReceiptModel.findOne({ receiptNo }).lean();
        if (dbReceipt) {
          return { ...(dbReceipt as any), id: (dbReceipt as any).id || (dbReceipt as any)._id?.toString() };
        }
        return null;
      }
    } catch (err) {
      console.warn('[ReceiptService] getByReceiptNoAsync error:', err);
    }
    return this.getByReceiptNo(receiptNo);
  }

  public getByReceiptNo(receiptNo: number): Receipt | null {
    const receipts = this.getAll();
    return receipts.find((r) => r.receiptNo === receiptNo) || null;
  }

  public async create(receiptData: Omit<Receipt, 'id'> & { receiptNo?: number }): Promise<Receipt> {
    let receiptNo = receiptData.receiptNo;
    if (!receiptNo || receiptNo <= 0) {
      receiptNo = await counterService.getNextSequence('receiptNo');
    }

    const newReceipt: Receipt = {
      ...receiptData,
      id: `RCPT-${Date.now()}`,
      receiptNo
    };

    // 1. Authoritative persistence to MongoDB
    try {
      if (!isMongoConnected()) {
        await ensureMongoConnected();
      }
      if (isMongoConnected()) {
        await ReceiptModel.create(newReceipt);
      }
    } catch (mongoErr: any) {
      console.error('[ReceiptService] MongoDB save error for receipt:', mongoErr);
    }

    // 2. Local File Repository & Sync Queue
    const receipts = this.getAll();
    receipts.unshift(newReceipt);
    googleDriveRepository.writeJson(FILE_NAME, receipts);

    // Enqueue background sync event
    syncQueueService.enqueue('receipt', String(receiptNo), 'CREATE', newReceipt);

    return newReceipt;
  }
}

export const receiptService = new ReceiptService();
