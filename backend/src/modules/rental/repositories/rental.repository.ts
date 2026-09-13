import {
  RentalComplex,
  RentalShop,
  RentalPayment,
  RentalExpense,
  RentalAuditLog,
  SyncQueueItem
} from '../types/rental.types.js';
import { telegramRepository } from '../../../telegram/telegram.repository.js';

export class RentalRepository {
  public clearCache(): void {
    // telegramCache handles caching
  }

  public writeJson(_fileName: string, _data: any): void {
    // Compatibility method for reset/seed scripts
  }

  public readJson<T = any>(_fileName: string, fallback: T): T {
    return fallback;
  }

  // ── Synchronous ID Generators ─────────────────────────────────────────────
  public nextComplexId(): string {
    const list = this.getComplexes();
    let max = 0;
    for (const c of list) {
      const num = parseInt((c.complexId || c.id || '').replace(/[^0-9]/g, '') || '0', 10);
      if (num > max) max = num;
    }
    return `CMP-${String(max + 1).padStart(4, '0')}`;
  }

  public nextShopId(): string {
    const list = this.getShops();
    let max = 0;
    for (const s of list) {
      const num = parseInt((s.shopId || s.id || '').replace(/[^0-9]/g, '') || '0', 10);
      if (num > max) max = num;
    }
    return `SHOP-${String(max + 1).padStart(4, '0')}`;
  }

  public nextPaymentId(): string {
    const list = this.getPayments();
    let max = 0;
    for (const p of list) {
      const num = parseInt((p.paymentId || p.id || '').replace(/[^0-9]/g, '') || '0', 10);
      if (num > max) max = num;
    }
    return `PAY-${String(max + 1).padStart(4, '0')}`;
  }

  public nextExpenseId(): string {
    const list = this.getExpenses();
    let max = 0;
    for (const e of list) {
      const num = parseInt((e.expenseId || e.id || '').replace(/[^0-9]/g, '') || '0', 10);
      if (num > max) max = num;
    }
    return `EXP-${String(max + 1).padStart(4, '0')}`;
  }

  public nextAuditId(): string {
    const list = this.getAuditLogs();
    let max = 0;
    for (const a of list) {
      const num = parseInt((a.auditId || a.id || '').replace(/[^0-9]/g, '') || '0', 10);
      if (num > max) max = num;
    }
    return `AUD-${String(max + 1).padStart(4, '0')}`;
  }

  public nextSyncId(): string {
    return `SYNC-${String(Date.now()).slice(-6)}`;
  }

  // ── Complexes CRUD ───────────────────────────────────────────────────────
  public getComplexes(): RentalComplex[] {
    return telegramRepository.getRecords<RentalComplex>('RENTAL_COMPLEX');
  }

  public getComplexById(idOrComplexId: string): RentalComplex | null {
    const list = this.getComplexes();
    return list.find((c) => c.id === idOrComplexId || c.complexId === idOrComplexId) || null;
  }

  public saveComplex(complex: RentalComplex): RentalComplex {
    const id = complex.complexId || complex.id;
    const existing = this.getComplexById(id);
    const updated = { ...complex, id, complexId: id, updatedAt: new Date().toISOString() };

    if (existing) {
      telegramRepository.updateRecord('RENTAL_COMPLEX', id, updated).catch(() => {});
    } else {
      telegramRepository.createRecord('RENTAL_COMPLEX', id, updated).catch(() => {});
    }

    return updated;
  }

  public deleteComplex(complexId: string): boolean {
    const existing = this.getComplexById(complexId);
    if (existing) {
      telegramRepository.deleteRecord('RENTAL_COMPLEX', existing.complexId || existing.id, false).catch(() => {});
      return true;
    }
    return false;
  }

  // ── Shops CRUD ───────────────────────────────────────────────────────────
  public getShops(): RentalShop[] {
    return telegramRepository.getRecords<RentalShop>('RENTAL_SHOP');
  }

  public getShopById(idOrShopId: string): RentalShop | null {
    const list = this.getShops();
    return list.find((s) => s.id === idOrShopId || s.shopId === idOrShopId) || null;
  }

  public getShopsByComplexId(complexId: string): RentalShop[] {
    return this.getShops().filter((s) => s.complexId === complexId);
  }

  public saveShop(shop: RentalShop): RentalShop {
    const id = shop.shopId || shop.id;
    const existing = this.getShopById(id);
    const updated = { ...shop, id, shopId: id, updatedAt: new Date().toISOString() };

    if (existing) {
      telegramRepository.updateRecord('RENTAL_SHOP', id, updated).catch(() => {});
    } else {
      telegramRepository.createRecord('RENTAL_SHOP', id, updated).catch(() => {});
    }

    return updated;
  }

  public deleteShop(shopId: string): boolean {
    const existing = this.getShopById(shopId);
    if (existing) {
      telegramRepository.deleteRecord('RENTAL_SHOP', existing.shopId || existing.id, false).catch(() => {});
      return true;
    }
    return false;
  }

  // ── Rent Payments CRUD ───────────────────────────────────────────────────
  public getPayments(): RentalPayment[] {
    return telegramRepository.getRecords<RentalPayment>('RENTAL_PAYMENT');
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
    const id = payment.paymentId || payment.id;
    const existing = this.getPaymentById(id);
    const updated = { ...payment, id, paymentId: id, updatedAt: new Date().toISOString() };

    if (existing) {
      telegramRepository.updateRecord('RENTAL_PAYMENT', id, updated).catch(() => {});
    } else {
      telegramRepository.createRecord('RENTAL_PAYMENT', id, updated).catch(() => {});
    }

    return updated;
  }

  // ── Expenses CRUD ────────────────────────────────────────────────────────
  public getExpenses(): RentalExpense[] {
    return telegramRepository.getRecords<RentalExpense>('RENTAL_EXPENSE');
  }

  public getExpenseById(idOrExpenseId: string): RentalExpense | null {
    const list = this.getExpenses();
    return list.find((e) => e.id === idOrExpenseId || e.expenseId === idOrExpenseId) || null;
  }

  public saveExpense(expense: RentalExpense): RentalExpense {
    const id = expense.expenseId || expense.id;
    const existing = this.getExpenseById(id);
    const updated = { ...expense, id, expenseId: id, updatedAt: new Date().toISOString() };

    if (existing) {
      telegramRepository.updateRecord('RENTAL_EXPENSE', id, updated).catch(() => {});
    } else {
      telegramRepository.createRecord('RENTAL_EXPENSE', id, updated).catch(() => {});
    }

    return updated;
  }

  public deleteExpense(expenseId: string): boolean {
    const existing = this.getExpenseById(expenseId);
    if (existing) {
      telegramRepository.deleteRecord('RENTAL_EXPENSE', existing.expenseId || existing.id, false).catch(() => {});
      return true;
    }
    return false;
  }

  // ── Audit Logs ───────────────────────────────────────────────────────────
  public getAuditLogs(): RentalAuditLog[] {
    const logs = telegramRepository.getRecords<RentalAuditLog>('RENTAL_AUDIT');
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public saveAuditLog(log: RentalAuditLog): RentalAuditLog {
    const id = log.id || `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const record = { ...log, id };
    telegramRepository.createRecord('RENTAL_AUDIT', id, record).catch(() => {});
    return record;
  }

  public setComplexes(complexes: RentalComplex[]): void {
    for (const c of complexes) {
      this.saveComplex(c);
    }
  }

  public setShops(shops: RentalShop[]): void {
    for (const s of shops) {
      this.saveShop(s);
    }
  }

  public setPayments(payments: RentalPayment[]): void {
    for (const p of payments) {
      this.savePayment(p);
    }
  }

  public setExpenses(expenses: RentalExpense[]): void {
    for (const e of expenses) {
      this.saveExpense(e);
    }
  }

  // ── Sync Queue CRUD ──────────────────────────────────────────────────────
  public getSyncQueue(): SyncQueueItem[] {
    return [];
  }

  public enqueueSync(item: SyncQueueItem): SyncQueueItem {
    return item;
  }

  public updateSyncItem(_item: SyncQueueItem): void {}

  public getPendingSyncItems(): SyncQueueItem[] {
    return [];
  }
}

export const rentalRepository = new RentalRepository();
export default rentalRepository;
