import { telegramRepository } from '../telegram/telegram.repository.js';
import { counterService } from './counter.service.js';
import { Customer } from '../types/index.js';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export class CustomerService {
  public async getAllAsync(includeDeleted: boolean = false): Promise<Customer[]> {
    return this.getAll(includeDeleted);
  }

  public getAll(includeDeleted: boolean = false): Customer[] {
    const list = telegramRepository.getRecords<Customer>('CUSTOMER', { includeDeleted });
    return list.map((c) => ({
      ...c,
      id: c.id || (c as any).customerId,
      name: c.name || (c as any).fullName,
      phone: c.phone || (c as any).phoneNumber,
      idProof: c.idProof || (c as any).idProofType || 'Aadhaar',
      idNumber: c.idNumber || (c as any).idProofNumber || '',
      customerPhoto: typeof c.customerPhoto === 'string' ? c.customerPhoto : ((c.customerPhoto as any)?.url || null)
    }));
  }

  public async getByIdAsync(id: string): Promise<Customer | null> {
    return this.getById(id);
  }

  public getById(id: string): Customer | null {
    const customers = this.getAll(true);
    const q = id.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    const qNum = qDigits ? parseInt(qDigits, 10) : null;

    return (
      customers.find((c) => {
        if (c.id && c.id.toLowerCase() === q) return true;
        if (c.customerId && c.customerId.toString() === q) return true;
        if (c.name && c.name.toLowerCase() === q) return true;
        if (qNum !== null) {
          if (c.customerId && c.customerId === qNum) return true;
          const cDigits = (c.id || '').replace(/\D/g, '');
          if (cDigits && parseInt(cDigits, 10) === qNum) return true;
        }
        return false;
      }) || null
    );
  }

  public search(query: string, includeDeleted: boolean = false): Customer[] {
    const q = query.toLowerCase().trim();
    const customers = this.getAll(includeDeleted);
    if (!q) return customers;

    const normQ = normalizePhone(q);
    return customers.filter((c) => {
      const idMatch = (c.id && c.id.toLowerCase().includes(q)) || (c.customerId && c.customerId.toString() === q);
      const nameMatch = c.name && c.name.toLowerCase().includes(q);
      const phoneMatch = (c.phone && c.phone.includes(q)) || (normQ && c.phone && normalizePhone(c.phone).includes(normQ));
      const idNumMatch = c.idNumber && c.idNumber.toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch || idNumMatch;
    });
  }

  public async create(
    data: Omit<Customer, 'id' | 'activeLoansCount' | 'totalBorrowed' | 'joinedDate'>,
    idempotencyKey?: string,
    actor?: any
  ): Promise<Customer> {
    const customers = this.getAll(true);
    const normPhone = normalizePhone(data.phone);

    // Check unique mobile number constraint among active (non-deleted) customers
    const existing = customers.find((c) => !c.isDeleted && normalizePhone(c.phone) === normPhone);
    if (existing) {
      const err: any = new Error('This mobile number is already registered to an existing customer.');
      err.statusCode = 409;
      err.code = 'DUPLICATE_PHONE_NUMBER';
      throw err;
    }

    // Generate unique sequential Customer ID
    const seq = await counterService.getNextSequence('customerId');
    const id = `CUST-${String(seq).padStart(3, '0')}`;

    const newCustomer: Customer = {
      ...data,
      id,
      customerId: seq,
      fullName: data.name || (data as any).fullName,
      phoneNumber: data.phone || (data as any).phoneNumber,
      phone: data.phone,
      phoneNormalized: normPhone,
      activeLoansCount: 0,
      totalBorrowed: 0,
      status: data.status || 'VERIFIED',
      joinedDate: new Date().toLocaleDateString('en-GB'),
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await telegramRepository.createRecord('CUSTOMER', id, newCustomer, actor);

    return newCustomer;
  }

  public async update(id: string, data: Partial<Customer>, actor?: any): Promise<Customer | null> {
    const customers = this.getAll(true);
    const target = customers.find((c) => c.id === id || (c.customerId && c.customerId.toString() === id));
    if (!target) return null;

    const actualId = target.id;

    if (data.phone) {
      const normPhone = normalizePhone(data.phone);
      const duplicate = customers.find(
        (c) => c.id !== actualId && !c.isDeleted && normalizePhone(c.phone) === normPhone
      );
      if (duplicate) {
        const err: any = new Error('This mobile number is already registered to another customer.');
        err.statusCode = 409;
        err.code = 'DUPLICATE_PHONE_NUMBER';
        throw err;
      }
      data.phoneNormalized = normPhone;
    }

    const updatedData: Customer = {
      ...target,
      ...data,
      id: actualId,
      customerId: target.customerId,
      updatedAt: new Date().toISOString()
    };

    await telegramRepository.updateRecord('CUSTOMER', actualId, updatedData, { actor });

    return updatedData;
  }

  public async delete(id: string, userRole?: string, actor?: any): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    if (userRole !== 'MASTER_ADMIN' && userRole !== 'ADMIN') {
      return {
        success: false,
        statusCode: 403,
        message: 'You do not have permission to delete customer records.'
      };
    }

    const target = this.getById(id);
    if (!target) {
      return { success: false, statusCode: 404, message: 'Customer not found' };
    }

    await telegramRepository.deleteRecord('CUSTOMER', target.id, false, actor || { role: userRole });
    return { success: true, message: 'Customer soft-deleted successfully' };
  }

  public async restore(id: string, userRole?: string, actor?: any): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    if (userRole !== 'MASTER_ADMIN' && userRole !== 'ADMIN') {
      return {
        success: false,
        statusCode: 403,
        message: 'You do not have permission to restore customer records.'
      };
    }

    const target = this.getById(id);
    if (!target) {
      return { success: false, statusCode: 404, message: 'Customer not found' };
    }

    await telegramRepository.restoreRecord('CUSTOMER', target.id, actor || { role: userRole });
    return { success: true, message: 'Customer restored successfully' };
  }

  public async deletePermanently(id: string, userRole?: string): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    if (userRole !== 'MASTER_ADMIN' && userRole !== 'ADMIN') {
      return {
        success: false,
        statusCode: 403,
        message: 'Only Master Admin has permission to permanently delete customer records.'
      };
    }

    const targetCust = this.getById(id);
    if (!targetCust) {
      return { success: false, statusCode: 404, message: 'Customer not found.' };
    }

    const custId = targetCust.id;

    // 1. Delete Customer from Telegram
    await telegramRepository.deleteRecord('CUSTOMER', custId, true);

    // 2. Cascade delete loans for this customer
    const loans = telegramRepository.getRecords<any>('LOAN', { includeDeleted: true });
    for (const l of loans) {
      if (l.customerId === custId || l.customerId === targetCust.customerId?.toString()) {
        await telegramRepository.deleteRecord('LOAN', l.id || l.loanNo, true);
      }
    }

    // 3. Cascade delete receipts
    const receipts = telegramRepository.getRecords<any>('RECEIPT', { includeDeleted: true });
    for (const r of receipts) {
      if (r.customerId === custId || r.customerId === targetCust.customerId?.toString()) {
        await telegramRepository.deleteRecord('RECEIPT', r.id || `RCPT-${r.receiptNo}`, true);
      }
    }

    return {
      success: true,
      message: `Customer ${targetCust.name} (${targetCust.id}) permanently deleted.`
    };
  }
}

export const customerService = new CustomerService();
export default customerService;
