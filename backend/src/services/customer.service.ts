import { googleDriveRepository } from '../repositories/googleDrive.repository.js';
import { syncQueueService } from './syncQueue.service.js';
import { counterService } from './counter.service.js';
import { getFinanceDb, isMongoConnected, ensureMongoConnected } from '../config/database.js';
import { Customer } from '../types/index.js';
import { CustomerModel } from '../models/Customer.js';

const FILE_NAME = 'customers.json';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

const initialCustomers: Customer[] = [];

export class CustomerService {
  public async getAllAsync(includeDeleted: boolean = false): Promise<Customer[]> {
    try {
      if (!isMongoConnected()) {
        await ensureMongoConnected();
      }
      if (isMongoConnected()) {
        const query = includeDeleted ? {} : { isDeleted: { $ne: true } };
        const dbCusts = await CustomerModel.find(query).sort({ createdAt: -1 }).lean();
        if (Array.isArray(dbCusts)) {
          const mapped: Customer[] = dbCusts.map((c: any) => ({
            ...c,
            id: c.customerId || c._id?.toString(),
            name: c.fullName || c.name,
            phone: c.phoneNumber || c.phone,
            idProof: c.idProofType || c.idProof,
            idNumber: c.idProofNumber || c.idNumber,
            customerPhoto: c.customerPhoto?.url || c.customerPhoto || null
          }));
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[CustomerService] getAllAsync Mongo error:', err);
    }
    return this.getAll(includeDeleted);
  }

  public getAll(includeDeleted: boolean = false): Customer[] {
    let list = googleDriveRepository.readJson<Customer[]>(FILE_NAME, initialCustomers);
    if (!Array.isArray(list)) {
      list = [];
    }
    if (includeDeleted) return list;
    return list.filter((c) => !c.isDeleted);
  }

  public getById(id: string): Customer | null {
    const customers = this.getAll(true);
    const q = id.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    const qNum = qDigits ? parseInt(qDigits, 10) : null;

    return (
      customers.find((c) => {
        if (c.id.toLowerCase() === q) return true;
        if (c.customerId && c.customerId.toString() === q) return true;
        if (c.name.toLowerCase() === q) return true;
        if (qNum !== null) {
          if (c.customerId && c.customerId === qNum) return true;
          const cDigits = c.id.replace(/\D/g, '');
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
      const idMatch = c.id.toLowerCase().includes(q) || (c.customerId && c.customerId.toString() === q);
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = c.phone.includes(q) || (normQ && normalizePhone(c.phone).includes(normQ));
      const idNumMatch = c.idNumber && c.idNumber.toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch || idNumMatch;
    });
  }

  public async create(
    data: Omit<Customer, 'id' | 'activeLoansCount' | 'totalBorrowed' | 'joinedDate'>,
    idempotencyKey?: string
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

    // 1. Centralized Atomic Unique Customer ID Generation via MongoDB Atlas
    const seq = await counterService.getNextSequence('customerId');
    const id = `CUST-${String(seq).padStart(3, '0')}`;

    // 2. Register Unique Customer Identity & Sync Metadata in MongoDB Atlas
    try {
      const db = await getFinanceDb();
      if (db) {
        await db.collection('customer_index').updateOne(
          { customerId: id },
          {
            $set: {
              customerId: id,
              numericId: seq,
              entityType: 'CUSTOMER',
              phoneNormalized: normPhone,
              version: 1,
              syncStatus: 'SYNCED',
              idempotencyKey: idempotencyKey || null,
              isDeleted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          { upsert: true }
        );
      }
    } catch (dbErr) {
      console.warn('[CustomerService] MongoDB customer identity index notice:', dbErr);
    }

    // 4. Construct Authoritative Business Customer Record in Google Drive
    const newCustomer: Customer = {
      ...data,
      id,
      customerId: seq,
      phone: data.phone,
      phoneNormalized: normPhone,
      activeLoansCount: 0,
      totalBorrowed: 0,
      status: data.status || 'VERIFIED',
      joinedDate: new Date().toLocaleDateString('en-GB'),
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      driveFolderId: undefined,
      kycDocumentDriveIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    customers.unshift(newCustomer);
    googleDriveRepository.writeJson(FILE_NAME, customers);

    try {
      if (isMongoConnected()) {
        await CustomerModel.findOneAndUpdate(
          { $or: [{ customerId: newCustomer.id }, { id: newCustomer.id }] },
          { $set: newCustomer },
          { upsert: true, new: true }
        );
      }
    } catch (mongoErr) {
      console.warn('[CustomerService] Mongo save customer error:', mongoErr);
    }

    // 5. Enqueue Durable Background Sync Outbox Event to Google Drive
    syncQueueService.enqueue('customer', newCustomer.id, 'CREATE', newCustomer);

    return newCustomer;
  }

  public async update(id: string, data: Partial<Customer>): Promise<Customer | null> {
    const customers = this.getAll(true);
    const index = customers.findIndex((c) => c.id === id || (c.customerId && c.customerId.toString() === id));
    if (index === -1) return null;

    if (data.phone) {
      const normPhone = normalizePhone(data.phone);
      const duplicate = customers.find(
        (c) => c.id !== customers[index].id && !c.isDeleted && normalizePhone(c.phone) === normPhone
      );
      if (duplicate) {
        const err: any = new Error('This mobile number is already registered to another customer.');
        err.statusCode = 409;
        err.code = 'DUPLICATE_PHONE_NUMBER';
        throw err;
      }
      data.phoneNormalized = normPhone;
    }

    const currentCust = customers[index];
    const updatedCustomer: Customer = {
      ...currentCust,
      ...data,
      id: currentCust.id, // Strictly protect original immutable Customer ID
      customerId: currentCust.customerId,
      updatedAt: new Date().toISOString()
    };

    customers[index] = updatedCustomer;
    googleDriveRepository.writeJson(FILE_NAME, customers);

    try {
      if (isMongoConnected()) {
        await CustomerModel.findOneAndUpdate(
          { $or: [{ customerId: currentCust.id }, { id: currentCust.id }] },
          { $set: updatedCustomer },
          { upsert: true, new: true }
        );
      }
    } catch (mongoErr) {
      console.warn('[CustomerService] Mongo update customer error:', mongoErr);
    }

    // Increment version in MongoDB Identity & Sync Index
    try {
      const db = await getFinanceDb();
      if (db) {
        await db.collection('customer_index').updateOne(
          { customerId: currentCust.id },
          {
            $inc: { version: 1 },
            $set: {
              phoneNormalized: updatedCustomer.phoneNormalized,
              syncStatus: 'SYNCED',
              updatedAt: updatedCustomer.updatedAt
            }
          }
        );
      }
    } catch (dbErr) {
      console.warn('[CustomerService] MongoDB index version update notice:', dbErr);
    }

    // Enqueue background sync event
    syncQueueService.enqueue('customer', updatedCustomer.id, 'UPDATE', updatedCustomer);

    return updatedCustomer;
  }

  public delete(id: string, userRole?: string): { success: boolean; statusCode?: number; message?: string } {
    if (userRole !== 'MASTER_ADMIN' && userRole !== 'ADMIN') {
      return {
        success: false,
        statusCode: 403,
        message: 'You do not have permission to delete customer records.'
      };
    }

    const customers = this.getAll(true);
    const index = customers.findIndex((c) => c.id === id || (c.customerId && c.customerId.toString() === id));
    if (index === -1) {
      return { success: false, statusCode: 404, message: 'Customer not found' };
    }

    // Perform Soft Delete
    customers[index].isDeleted = true;
    customers[index].deletedAt = new Date().toISOString();
    customers[index].deletedBy = userRole || 'MASTER_ADMIN';

    googleDriveRepository.writeJson(FILE_NAME, customers);

    if (isMongoConnected()) {
      CustomerModel.updateOne(
        { $or: [{ customerId: id }, { id }] },
        { $set: { isDeleted: true, deletedAt: customers[index].deletedAt, deletedBy: customers[index].deletedBy } }
      ).catch((err: any) => console.warn('[CustomerService] Mongo soft delete error:', err));
    }

    // Enqueue background sync event
    syncQueueService.enqueue('customer', id, 'DELETE', { id, isDeleted: true });

    return { success: true, message: 'Customer soft-deleted successfully' };
  }

  public restore(id: string, userRole?: string): { success: boolean; statusCode?: number; message?: string } {
    if (userRole !== 'MASTER_ADMIN' && userRole !== 'ADMIN') {
      return {
        success: false,
        statusCode: 403,
        message: 'You do not have permission to restore customer records.'
      };
    }

    const customers = this.getAll(true);
    const index = customers.findIndex((c) => c.id === id || (c.customerId && c.customerId.toString() === id));
    if (index === -1) {
      return { success: false, statusCode: 404, message: 'Customer not found' };
    }

    customers[index].isDeleted = false;
    customers[index].deletedAt = null;
    customers[index].deletedBy = null;

    googleDriveRepository.writeJson(FILE_NAME, customers);

    if (isMongoConnected()) {
      CustomerModel.updateOne(
        { $or: [{ customerId: id }, { id }] },
        { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
      ).catch((err: any) => console.warn('[CustomerService] Mongo restore error:', err));
    }

    return { success: true, message: 'Customer restored successfully' };
  }

  public deletePermanently(id: string, userRole?: string): { success: boolean; statusCode?: number; message?: string } {
    if (userRole !== 'MASTER_ADMIN' && userRole !== 'ADMIN') {
      return {
        success: false,
        statusCode: 403,
        message: 'Only Master Admin has permission to permanently delete customer records.'
      };
    }

    const customers = this.getAll(true);
    const targetCust = customers.find((c) => c.id === id || (c.customerId && c.customerId.toString() === id));
    if (!targetCust) {
      return { success: false, statusCode: 404, message: 'Customer not found.' };
    }

    const custId = targetCust.id;
    const numericCustIdStr = targetCust.customerId ? targetCust.customerId.toString() : '';

    // 1. Remove Customer from customers.json
    const updatedCustomers = customers.filter(
      (c) => c.id !== custId && (numericCustIdStr ? c.customerId?.toString() !== numericCustIdStr : true)
    );
    googleDriveRepository.writeJson(FILE_NAME, updatedCustomers);

    if (isMongoConnected()) {
      CustomerModel.deleteMany({ $or: [{ customerId: custId }, { id: custId }] }).catch((err: any) =>
        console.warn('[CustomerService] Mongo permanent delete error:', err)
      );
    }

    // 2. Cascade delete all loans connected to customerId from loans.json
    const loans = googleDriveRepository.readJson<any[]>('loans.json', []);
    const deletedLoanNos = new Set<string>();
    const deletedLoanIds = new Set<string>();

    loans.forEach((l) => {
      if (l.customerId === custId || (numericCustIdStr && l.customerId === numericCustIdStr)) {
        deletedLoanNos.add(l.loanNo);
        deletedLoanIds.add(l.id);
      }
    });

    const updatedLoans = loans.filter(
      (l) => l.customerId !== custId && (numericCustIdStr ? l.customerId !== numericCustIdStr : true)
    );
    googleDriveRepository.writeJson('loans.json', updatedLoans);

    // 3. Cascade delete all receipts connected to customerId or deleted loans from receipts.json
    const receipts = googleDriveRepository.readJson<any[]>('receipts.json', []);
    const updatedReceipts = receipts.filter(
      (r) =>
        r.customerId !== custId &&
        (numericCustIdStr ? r.customerId !== numericCustIdStr : true) &&
        !deletedLoanNos.has(r.loanNo) &&
        !deletedLoanIds.has(r.loanId)
    );
    googleDriveRepository.writeJson('receipts.json', updatedReceipts);

    // 4. Cascade delete daybook entries for customer or deleted loans from daybook.json
    const daybook = googleDriveRepository.readJson<any[]>('daybook.json', []);
    const updatedDaybook = daybook.filter(
      (d) =>
        d.customerName !== targetCust.name &&
        !deletedLoanNos.has(d.loanNo)
    );
    googleDriveRepository.writeJson('daybook.json', updatedDaybook);

    return {
      success: true,
      message: `Customer ${targetCust.name} (${targetCust.id}) and all associated records permanently deleted successfully.`
    };
  }
}

export const customerService = new CustomerService();
