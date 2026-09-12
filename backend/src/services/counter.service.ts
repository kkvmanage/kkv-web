import { googleDriveRepository } from '../repositories/googleDrive.repository.js';
import { getFinanceDb } from '../config/database.js';
import { localFileRepository } from '../repositories/localFile.repository.js';
import { Loan } from '../types/index.js';

const FILE_NAME = 'counters.json';

export class CounterService {
  private getCounters(): Record<string, number> {
    return googleDriveRepository.readJson<Record<string, number>>(FILE_NAME, {
      customerId: 0,
      loanSequence: 0,
      receiptNo: 0,
      fdNo: 0
    });
  }

  private setLocalIfHigher(name: string, value: number): void {
    const counters = this.getCounters();
    if ((counters[name] || 0) < value) {
      counters[name] = value;
      googleDriveRepository.writeJson(FILE_NAME, counters);
    }
  }

  /**
   * Scans existing loans in storage to find the highest existing numeric sequence.
   * On a fresh database with 0 loans, returns 0.
   */
  public getHighestExistingLoanNumber(): number {
    try {
      const loans = localFileRepository.readJson<Loan[]>('loans.json', []);
      let maxSeq = 0;
      if (Array.isArray(loans)) {
        for (const l of loans) {
          const match = (l.loanNo || '').match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxSeq) maxSeq = num;
          }
        }
      }
      return maxSeq;
    } catch {
      return 0;
    }
  }

  /**
   * Concurrency-safe atomic counter generation via MongoDB Atlas with local fallback
   */
  public async getNextSequence(name: string): Promise<number> {
    const counters = this.getCounters();
    const localBase = counters[name] || (name === 'receiptNo' ? counters.receipt : name === 'customerId' ? counters.customer : 0) || 0;

    try {
      const db = await getFinanceDb();
      if (db) {
        if (localBase > 0) {
          await db.collection('counters').updateOne(
            { _id: name as any },
            { $max: { seq: localBase } },
            { upsert: true }
          );
        }
        const result = await db.collection('counters').findOneAndUpdate(
          { _id: name as any },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: 'after' }
        );
        const seqVal = (result as any)?.seq ?? (result as any)?.value?.seq;
        if (typeof seqVal === 'number') {
          this.setLocalIfHigher(name, seqVal);
          if (name === 'receiptNo') this.setLocalIfHigher('receipt', seqVal);
          if (name === 'customerId') this.setLocalIfHigher('customer', seqVal);
          return seqVal;
        }
      }
    } catch (err) {
      console.warn(`[CounterService] MongoDB counter atomic fetch warning for ${name}:`, err);
    }

    // Fallback to local / Drive file counter
    const nextVal = localBase + 1;
    counters[name] = nextVal;
    if (name === 'receiptNo') counters.receipt = nextVal;
    if (name === 'customerId') counters.customer = nextVal;
    googleDriveRepository.writeJson(FILE_NAME, counters);
    return nextVal;
  }

  /**
   * Authoritative Unified Next Loan Sequence Generator
   * Generates next positive integer (starts from 1 on fresh DB, or max existing loan + 1).
   * Atomically increments and updates database/local counter.
   */
  public async getNextLoanSequence(): Promise<number> {
    const maxExisting = this.getHighestExistingLoanNumber();
    const counters = this.getCounters();
    const currentCounter = counters.loanSequence || counters.loanNo || 0;
    const baseSeq = Math.max(maxExisting, currentCounter);

    try {
      const db = await getFinanceDb();
      if (db) {
        await db.collection('counters').updateOne(
          { _id: 'loanSequence' as any },
          { $max: { seq: baseSeq } },
          { upsert: true }
        );
        const result = await db.collection('counters').findOneAndUpdate(
          { _id: 'loanSequence' as any },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: 'after' }
        );
        const seqVal = (result as any)?.seq ?? (result as any)?.value?.seq;
        if (typeof seqVal === 'number') {
          this.setLocalIfHigher('loanSequence', seqVal);
          this.setLocalIfHigher('loanNo', seqVal);
          return seqVal;
        }
      }
    } catch (err) {
      console.warn('[CounterService] MongoDB atomic loan sequence warning:', err);
    }

    const nextVal = baseSeq + 1;
    counters.loanSequence = nextVal;
    counters.loanNo = nextVal;
    googleDriveRepository.writeJson(FILE_NAME, counters);
    return nextVal;
  }

  /**
   * Peeks next loan sequence without incrementing (for UI preview)
   */
  public async peekNextLoanSequence(): Promise<number> {
    const maxExisting = this.getHighestExistingLoanNumber();
    const counters = this.getCounters();
    const currentCounter = counters.loanSequence || counters.loanNo || 0;
    let dbCounter = 0;
    try {
      const db = await getFinanceDb();
      if (db) {
        const doc = await db.collection('counters').findOne({ _id: 'loanSequence' as any });
        if (doc && typeof doc.seq === 'number') {
          dbCounter = doc.seq;
        }
      }
    } catch {
      // Ignore
    }
    return Math.max(maxExisting, currentCounter, dbCounter) + 1;
  }

  public async getNextLoanNo(): Promise<string> {
    const seq = await this.getNextLoanSequence();
    return `GL-${seq}`;
  }

  public async getNextCustomerId(): Promise<string> {
    const seq = await this.getNextSequence('customerId');
    return `CUST-${String(seq).padStart(3, '0')}`;
  }

  public async getNextReceiptNo(): Promise<number> {
    return await this.getNextSequence('receiptNo');
  }

  public async getNextFdNo(): Promise<string> {
    const seq = await this.getNextSequence('fdNo');
    return `FD-${String(seq).padStart(4, '0')}`;
  }

  public async setSequenceIfHigher(name: string, value: number): Promise<void> {
    const namesToSet = [name];
    if (name === 'receipt') namesToSet.push('receiptNo');
    if (name === 'receiptNo') namesToSet.push('receipt');
    if (name === 'customer') namesToSet.push('customerId');
    if (name === 'customerId') namesToSet.push('customer');
    if (name === 'loan') namesToSet.push('loanSequence', 'loanNo');
    if (name === 'loanSequence' || name === 'loanNo') namesToSet.push('loan');

    try {
      const db = await getFinanceDb();
      if (db) {
        for (const n of namesToSet) {
          await db.collection('counters').updateOne(
            { _id: n as any },
            { $max: { seq: value } },
            { upsert: true }
          );
        }
      }
    } catch (err) {
      console.warn(`[CounterService] MongoDB counter update warning for ${name}:`, err);
    }

    for (const n of namesToSet) {
      this.setLocalIfHigher(n, value);
    }
  }

  public async resetAllSequences(): Promise<void> {
    try {
      const db = await getFinanceDb();
      if (db) {
        await db.collection('counters').deleteMany({});
      }
    } catch (err) {
      console.warn('[CounterService] MongoDB counter reset warning:', err);
    }
    googleDriveRepository.writeJson(FILE_NAME, {
      customerId: 0,
      loanSequence: 0,
      loanNo: 0,
      receiptNo: 0,
      fdNo: 0
    });
  }
}

export const counterService = new CounterService();


