import { telegramRepository } from '../telegram/telegram.repository.js';
import { Loan } from '../types/index.js';

interface CounterData {
  customerId: number;
  loanSequence: number;
  loanNo: number;
  receiptNo: number;
  fdNo: number;
  [key: string]: number;
}

const COUNTER_RECORD_ID = 'APP_COUNTERS';

export class CounterService {
  private getCounters(): CounterData {
    const envelope = telegramRepository.getRecordById<CounterData>('COUNTER', COUNTER_RECORD_ID, true);
    if (envelope && envelope.data) {
      return envelope.data;
    }
    return {
      customerId: 0,
      loanSequence: 0,
      loanNo: 0,
      receiptNo: 0,
      fdNo: 0
    };
  }

  private async saveCounters(counters: CounterData): Promise<void> {
    const existing = telegramRepository.getRecordById<CounterData>('COUNTER', COUNTER_RECORD_ID, true);
    if (existing) {
      await telegramRepository.updateRecord('COUNTER', COUNTER_RECORD_ID, counters);
    } else {
      await telegramRepository.createRecord('COUNTER', COUNTER_RECORD_ID, counters);
    }
  }

  /**
   * Scans existing loans in Telegram storage to find the highest existing numeric sequence.
   */
  public getHighestExistingLoanNumber(): number {
    try {
      const loans = telegramRepository.getRecords<Loan>('LOAN', { includeDeleted: true });
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
   * Scans existing customers to find highest ID
   */
  public getHighestExistingCustomerNumber(): number {
    try {
      const custs = telegramRepository.getRecords<any>('CUSTOMER', { includeDeleted: true });
      let maxSeq = 0;
      for (const c of custs) {
        if (typeof c.customerId === 'number' && c.customerId > maxSeq) {
          maxSeq = c.customerId;
        }
        const match = (c.id || '').match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
      return maxSeq;
    } catch {
      return 0;
    }
  }

  /**
   * Scans existing receipts to find highest receipt number
   */
  public getHighestExistingReceiptNumber(): number {
    try {
      const receipts = telegramRepository.getRecords<any>('RECEIPT', { includeDeleted: true });
      let maxSeq = 0;
      for (const r of receipts) {
        if (typeof r.receiptNo === 'number' && r.receiptNo > maxSeq) {
          maxSeq = r.receiptNo;
        }
      }
      return maxSeq;
    } catch {
      return 0;
    }
  }

  /**
   * Sequence Generator with automatic high-water-mark detection across existing records
   */
  public async getNextSequence(name: string): Promise<number> {
    const counters = this.getCounters();
    let current = counters[name] || 0;

    if (name === 'customerId' || name === 'customer') {
      const highest = this.getHighestExistingCustomerNumber();
      current = Math.max(current, highest);
    } else if (name === 'receiptNo' || name === 'receipt') {
      const highest = this.getHighestExistingReceiptNumber();
      current = Math.max(current, highest);
    }

    const nextVal = current + 1;
    counters[name] = nextVal;
    if (name === 'receiptNo') counters.receipt = nextVal;
    if (name === 'customerId') counters.customer = nextVal;

    await this.saveCounters(counters);
    return nextVal;
  }

  /**
   * Authoritative Unified Next Loan Sequence Generator
   */
  public async getNextLoanSequence(): Promise<number> {
    const maxExisting = this.getHighestExistingLoanNumber();
    const counters = this.getCounters();
    const currentCounter = counters.loanSequence || counters.loanNo || 0;
    const baseSeq = Math.max(maxExisting, currentCounter);

    const nextVal = baseSeq + 1;
    counters.loanSequence = nextVal;
    counters.loanNo = nextVal;

    await this.saveCounters(counters);
    return nextVal;
  }

  public async peekNextLoanSequence(): Promise<number> {
    const maxExisting = this.getHighestExistingLoanNumber();
    const counters = this.getCounters();
    const currentCounter = counters.loanSequence || counters.loanNo || 0;
    return Math.max(maxExisting, currentCounter) + 1;
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
    const counters = this.getCounters();
    if ((counters[name] || 0) < value) {
      counters[name] = value;
      if (name === 'receipt') counters.receiptNo = value;
      if (name === 'receiptNo') counters.receipt = value;
      if (name === 'customer') counters.customerId = value;
      if (name === 'customerId') counters.customer = value;
      if (name === 'loan' || name === 'loanNo') counters.loanSequence = value;
      await this.saveCounters(counters);
    }
  }

  public async resetAllSequences(): Promise<void> {
    const counters: CounterData = {
      customerId: 0,
      loanSequence: 0,
      loanNo: 0,
      receiptNo: 0,
      fdNo: 0
    };
    await this.saveCounters(counters);
  }
}

export const counterService = new CounterService();
export default counterService;
