import fs from 'fs';
import path from 'path';
import {
  RentalComplex,
  RentalShop,
  RentalPayment,
  RentalExpense,
  RentalAuditLog,
  SyncQueueItem
} from '../types/rental.types.js';
import {
  getStorageBaseDir,
  getStorageSubdirectory,
  ensureDirectoryExists
} from '../../../config/storage.js';
import { getFinanceDb, isMongoConnected, ensureMongoConnected } from '../../../config/database.js';

interface Counters {
  complex: number;
  shop: number;
  payment: number;
  expense: number;
  audit: number;
  sync: number;
}

export class RentalRepository {
  private baseDir: string;
  private rentalDir: string;
  private memoryCache: Map<string, any> = new Map();

  constructor() {
    this.baseDir = getStorageBaseDir();
    this.rentalDir = getStorageSubdirectory('rental');
    this.initFolders();
  }

  public clearCache(filename?: string): void {
    if (filename) {
      this.memoryCache.delete(filename);
    } else {
      this.memoryCache.clear();
    }
  }

  private initFolders(): void {
    try {
      ensureDirectoryExists(this.baseDir);
      ensureDirectoryExists(this.rentalDir);

      // Initialize counter file if not exists
      const counterFile = path.join(this.rentalDir, 'counters.json');
      if (!fs.existsSync(counterFile) && !this.memoryCache.has('counters.json')) {
        this.writeJson('counters.json', {
          complex: 0,
          shop: 0,
          payment: 0,
          expense: 0,
          audit: 0,
          sync: 0
        });
      }
    } catch (err) {
      console.warn('[RentalRepository] Safe folder initialization warning:', err);
    }
  }

  public readJson<T>(filename: string, fallback: T): T {
    try {
      const filePath = path.join(this.rentalDir, filename);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as T;
        this.memoryCache.set(filename, parsed);
        return parsed;
      }
    } catch (err) {
      console.warn(`[RentalRepository] Error reading ${filename} from disk:`, err);
    }

    if (this.memoryCache.has(filename)) {
      return this.memoryCache.get(filename) as T;
    }

    this.writeJson(filename, fallback);
    return fallback;
  }

  public writeJson<T>(filename: string, data: T): boolean {
    this.memoryCache.set(filename, data);
    try {
      ensureDirectoryExists(this.rentalDir);
      const filePath = path.join(this.rentalDir, filename);
      const tempPath = `${filePath}.tmp_${Date.now()}`;
      const content = JSON.stringify(data, null, 2);

      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, filePath);
      return true;
    } catch (err) {
      console.warn(`[RentalRepository] Filesystem write warning for ${filename} (cached in-memory):`, err);
      return true;
    }
  }

  // ── ID Generators ────────────────────────────────────────────────────────
  private getNextSeq(type: keyof Counters, prefix: string, padLen = 4): string {
    const counters = this.readJson<Counters>('counters.json', {
      complex: 0,
      shop: 0,
      payment: 0,
      expense: 0,
      audit: 0,
      sync: 0
    });
    counters[type] = (counters[type] || 0) + 1;
    this.writeJson('counters.json', counters);
    return `${prefix}-${String(counters[type]).padStart(padLen, '0')}`;
  }

  public nextComplexId(): string {
    return this.getNextSeq('complex', 'CMP');
  }

  public nextShopId(): string {
    return this.getNextSeq('shop', 'SHOP');
  }

  public nextPaymentId(): string {
    return this.getNextSeq('payment', 'PAY');
  }

  public nextExpenseId(): string {
    return this.getNextSeq('expense', 'EXP');
  }

  public nextAuditId(): string {
    return this.getNextSeq('audit', 'AUD');
  }

  public nextSyncId(): string {
    return this.getNextSeq('sync', 'SYNC');
  }

  // ── Complexes CRUD ───────────────────────────────────────────────────────
  public getComplexes(): RentalComplex[] {
    return this.readJson<RentalComplex[]>('complexes.json', []);
  }

  public getComplexById(idOrComplexId: string): RentalComplex | null {
    const list = this.getComplexes();
    return list.find((c) => c.id === idOrComplexId || c.complexId === idOrComplexId) || null;
  }

  public saveComplex(complex: RentalComplex): RentalComplex {
    const list = this.getComplexes();
    const existingIndex = list.findIndex((c) => c.complexId === complex.complexId || c.id === complex.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...complex, updatedAt: new Date().toISOString() };
    } else {
      list.push(complex);
    }
    this.writeJson('complexes.json', list);

    // Asynchronously persist to MongoDB
    getFinanceDb().then((db) => {
      if (db) {
        db.collection('rental_complexes').updateOne(
          { $or: [{ complexId: complex.complexId }, { id: complex.id }] },
          { $set: complex },
          { upsert: true }
        ).catch((err) => console.warn('[RentalRepository] Mongo saveComplex error:', err));
      }
    }).catch(() => {});

    return complex;
  }

  // ── Shops CRUD ───────────────────────────────────────────────────────────
  public getShops(): RentalShop[] {
    return this.readJson<RentalShop[]>('shops.json', []);
  }

  public getShopById(idOrShopId: string): RentalShop | null {
    const list = this.getShops();
    return list.find((s) => s.id === idOrShopId || s.shopId === idOrShopId) || null;
  }

  public getShopsByComplexId(complexId: string): RentalShop[] {
    return this.getShops().filter((s) => s.complexId === complexId);
  }

  public saveShop(shop: RentalShop): RentalShop {
    const list = this.getShops();
    const existingIndex = list.findIndex((s) => s.shopId === shop.shopId || s.id === shop.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...shop, updatedAt: new Date().toISOString() };
    } else {
      list.push(shop);
    }
    this.writeJson('shops.json', list);

    // Asynchronously persist to MongoDB
    getFinanceDb().then((db) => {
      if (db) {
        db.collection('rental_shops').updateOne(
          { $or: [{ shopId: shop.shopId }, { id: shop.id }] },
          { $set: shop },
          { upsert: true }
        ).catch((err) => console.warn('[RentalRepository] Mongo saveShop error:', err));
      }
    }).catch(() => {});

    return shop;
  }

  // ── Rent Payments CRUD ───────────────────────────────────────────────────
  public getPayments(): RentalPayment[] {
    return this.readJson<RentalPayment[]>('rent_payments.json', []);
  }

  public getPaymentById(idOrPaymentId: string): RentalPayment | null {
    const list = this.getPayments();
    return list.find((p) => p.id === idOrPaymentId || p.paymentId === idOrPaymentId) || null;
  }

  public getPaymentsByShopId(shopId: string): RentalPayment[] {
    return this.getPayments().filter((p) => p.shopId === shopId);
  }

  public getPaymentsByMonth(paymentMonth: string): RentalPayment[] {
    return this.getPayments().filter((p) => p.paymentMonth === paymentMonth);
  }

  public savePayment(payment: RentalPayment): RentalPayment {
    const list = this.getPayments();
    const existingIndex = list.findIndex((p) => p.paymentId === payment.paymentId || p.id === payment.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...payment, updatedAt: new Date().toISOString() };
    } else {
      list.push(payment);
    }
    this.writeJson('rent_payments.json', list);

    // Asynchronously persist to MongoDB
    getFinanceDb().then((db) => {
      if (db) {
        db.collection('rental_payments').updateOne(
          { $or: [{ paymentId: payment.paymentId }, { id: payment.id }] },
          { $set: payment },
          { upsert: true }
        ).catch((err) => console.warn('[RentalRepository] Mongo savePayment error:', err));
      }
    }).catch(() => {});

    return payment;
  }

  // ── Expenses CRUD ────────────────────────────────────────────────────────
  public getExpenses(): RentalExpense[] {
    return this.readJson<RentalExpense[]>('expenses.json', []);
  }

  public getExpenseById(idOrExpenseId: string): RentalExpense | null {
    const list = this.getExpenses();
    return list.find((e) => e.id === idOrExpenseId || e.expenseId === idOrExpenseId) || null;
  }

  public saveExpense(expense: RentalExpense): RentalExpense {
    const list = this.getExpenses();
    const existingIndex = list.findIndex((e) => e.expenseId === expense.expenseId || e.id === expense.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...expense, updatedAt: new Date().toISOString() };
    } else {
      list.push(expense);
    }
    this.writeJson('expenses.json', list);

    // Asynchronously persist to MongoDB
    getFinanceDb().then((db) => {
      if (db) {
        db.collection('rental_expenses').updateOne(
          { $or: [{ expenseId: expense.expenseId }, { id: expense.id }] },
          { $set: expense },
          { upsert: true }
        ).catch((err) => console.warn('[RentalRepository] Mongo saveExpense error:', err));
      }
    }).catch(() => {});

    return expense;
  }

  public deleteExpense(expenseId: string): boolean {
    const list = this.getExpenses();
    const filtered = list.filter((e) => e.expenseId !== expenseId && e.id !== expenseId);
    if (filtered.length !== list.length) {
      this.writeJson('expenses.json', filtered);

      // Asynchronously delete in MongoDB
      getFinanceDb().then((db) => {
        if (db) {
          db.collection('rental_expenses').deleteOne({
            $or: [{ expenseId }, { id: expenseId }]
          }).catch((err) => console.warn('[RentalRepository] Mongo deleteExpense error:', err));
        }
      }).catch(() => {});

      return true;
    }
    return false;
  }

  // ── Audit Logs ───────────────────────────────────────────────────────────
  public getAuditLogs(): RentalAuditLog[] {
    return this.readJson<RentalAuditLog[]>('audit_logs.json', []);
  }

  public saveAuditLog(log: RentalAuditLog): RentalAuditLog {
    const list = this.getAuditLogs();
    list.unshift(log); // newest first
    // keep maximum 2000 logs
    if (list.length > 2000) list.length = 2000;
    this.writeJson('audit_logs.json', list);

    // Asynchronously persist to MongoDB
    getFinanceDb().then((db) => {
      if (db) {
        db.collection('rental_audit_logs').insertOne(log).catch((err) =>
          console.warn('[RentalRepository] Mongo saveAuditLog error:', err)
        );
      }
    }).catch(() => {});

    return log;
  }

  // ── Sync Queue CRUD ──────────────────────────────────────────────────────
  public getSyncQueue(): SyncQueueItem[] {
    return this.readJson<SyncQueueItem[]>('sync_queue.json', []);
  }

  public enqueueSync(item: SyncQueueItem): SyncQueueItem {
    const list = this.getSyncQueue();
    // remove any existing pending item for same entityId
    const filtered = list.filter((q) => q.entityId !== item.entityId || q.status === 'SYNCED');
    filtered.push(item);
    this.writeJson('sync_queue.json', filtered);

    getFinanceDb().then((db) => {
      if (db) {
        db.collection('rental_sync_queue').updateOne(
          { id: item.id },
          { $set: item },
          { upsert: true }
        ).catch((err) => console.warn('[RentalRepository] Mongo enqueueSync error:', err));
      }
    }).catch(() => {});

    return item;
  }

  public updateSyncItem(item: SyncQueueItem): void {
    const list = this.getSyncQueue();
    const index = list.findIndex((q) => q.id === item.id);
    if (index >= 0) {
      list[index] = item;
      this.writeJson('sync_queue.json', list);

      getFinanceDb().then((db) => {
        if (db) {
          db.collection('rental_sync_queue').updateOne(
            { id: item.id },
            { $set: item }
          ).catch((err) => console.warn('[RentalRepository] Mongo updateSyncItem error:', err));
        }
      }).catch(() => {});
    }
  }

  public getPendingSyncItems(): SyncQueueItem[] {
    return this.getSyncQueue().filter((q) => q.status === 'PENDING' || q.status === 'FAILED');
  }
}

export const rentalRepository = new RentalRepository();
