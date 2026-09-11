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
    try {
      const db = await getFinanceDb();
      if (db) {
        const result = await db.collection('counters').findOneAndUpdate(
          { _id: name as any },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: 'after' }
        );
        const seqVal = (result as any)?.seq ?? (result as any)?.value?.seq;
        if (typeof seqVal === 'number') {
          this.setLocalIfHigher(name, seqVal);
          return seqVal;
        }
      }
    } catch (err) {
      console.warn(`[CounterService] MongoDB counter atomic fetch warning for ${name}:`, err);
    }

    // Fallback to local / Drive file counter
    const counters = this.getCounters();
    const nextVal = (counters[name] || 0) + 1;
    counters[name] = nextVal;
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
    try {
      const db = await getFinanceDb();
      if (db) {
        await db.collection('counters').updateOne(
          { _id: name as any },
          { $max: { seq: value } },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn(`[CounterService] MongoDB counter update warning for ${name}:`, err);
    }

    this.setLocalIfHigher(name, value);
  }
}

export const counterService = new CounterService();

