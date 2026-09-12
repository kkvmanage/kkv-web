import fs from 'fs';
import path from 'path';
import { RentalDayBookEntry } from '../types/rental.types.js';
import {
  getStorageBaseDir,
  getStorageSubdirectory,
  ensureDirectoryExists
} from '../../../config/storage.js';
import { getFinanceDb } from '../../../config/database.js';

export class RentalDayBookRepository {
  private baseDir: string;
  private rentalDir: string;
  private memoryCache: Map<string, any> = new Map();

  constructor() {
    this.baseDir = getStorageBaseDir();
    this.rentalDir = getStorageSubdirectory('rental');
    this.initFolders();
  }

  private initFolders(): void {
    try {
      ensureDirectoryExists(this.baseDir);
      ensureDirectoryExists(this.rentalDir);

      const dbFile = path.join(this.rentalDir, 'rental_daybook.json');
      if (!fs.existsSync(dbFile) && !this.memoryCache.has('rental_daybook.json')) {
        this.writeJson('rental_daybook.json', []);
      }
    } catch (err) {
      console.warn('[RentalDayBookRepository] Folder init warning:', err);
    }
  }

  public readJson<T>(filename: string, fallback: T): T {
    try {
      const filePath = path.join(this.rentalDir, filename);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`[RentalDayBookRepository] Read file error for ${filename}:`, err);
    }
    if (this.memoryCache.has(filename)) {
      return this.memoryCache.get(filename);
    }
    return fallback;
  }

  public clearCache(filename?: string): void {
    if (filename) {
      this.memoryCache.delete(filename);
    } else {
      this.memoryCache.clear();
    }
  }

  public writeJson<T>(filename: string, data: T): void {
    this.memoryCache.set(filename, data);
    try {
      const filePath = path.join(this.rentalDir, filename);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.warn(`[RentalDayBookRepository] Disk write warning for ${filename}:`, err);
    }
  }

  public async getManualEntries(): Promise<RentalDayBookEntry[]> {
    try {
      const db = await getFinanceDb();
      if (db) {
        const col = db.collection('rental_daybook');
        const docs = await col.find({}).toArray();
        return (docs || []).map(d => ({
          id: d.id || d._id.toString(),
          voucherNo: d.voucherNo,
          date: d.date,
          transactionType: d.transactionType,
          category: d.category,
          description: d.description,
          complexId: d.complexId,
          complexName: d.complexName,
          shopId: d.shopId,
          shopNumber: d.shopNumber,
          shopName: d.shopName,
          tenantName: d.tenantName,
          paymentMode: d.paymentMode,
          debit: d.debit || 0,
          credit: d.credit || 0,
          runningBalance: d.runningBalance,
          referenceType: d.referenceType || 'MANUAL',
          referenceId: d.referenceId || d.id,
          entrySource: d.entrySource || 'MANUAL',
          notes: d.notes,
          createdBy: d.createdBy,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString()
        })) as RentalDayBookEntry[];
      }
    } catch (dbErr) {
      console.warn('[RentalDayBookRepository] MongoDB query warning, reading local storage:', dbErr);
    }

    return this.readJson<RentalDayBookEntry[]>('rental_daybook.json', []);
  }

  public async saveManualEntry(entry: RentalDayBookEntry): Promise<RentalDayBookEntry> {
    const list = await this.getManualEntries();
    const existingIndex = list.findIndex(e => e.id === entry.id || e.voucherNo === entry.voucherNo);
    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }

    this.writeJson('rental_daybook.json', list);

    try {
      const db = await getFinanceDb();
      if (db) {
        const col = db.collection('rental_daybook');
        await col.updateOne(
          { $or: [{ id: entry.id }, { voucherNo: entry.voucherNo }] },
          { $set: entry },
          { upsert: true }
        );
      }
    } catch (dbErr) {
      console.warn('[RentalDayBookRepository] MongoDB upsert warning for manual entry:', dbErr);
    }

    return entry;
  }
}

export const rentalDayBookRepository = new RentalDayBookRepository();
