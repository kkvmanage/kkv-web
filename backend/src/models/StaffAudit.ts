import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IStaffAudit {
  _id?: string;
  id?: string;
  staffId?: string;
  staffUid?: string;
  staffEmail?: string;
  action: string;
  performedBy: string;
  actorEmail?: string;
  description: string;
  details?: string | any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date | string;
  createdAt?: Date | string;
}

export class StaffAuditModel {
  public static async create(data: Partial<IStaffAudit>): Promise<IStaffAudit> {
    const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const auditRecord: IStaffAudit = {
      _id: id,
      id,
      staffId: data.staffId || 'SYSTEM',
      staffUid: data.staffUid || data.staffId || 'SYSTEM',
      staffEmail: data.staffEmail || '',
      action: data.action || 'GENERAL_AUDIT',
      performedBy: data.performedBy || 'SYSTEM',
      actorEmail: data.actorEmail || '',
      description: data.description || '',
      details: data.details || '',
      ipAddress: data.ipAddress || '',
      userAgent: data.userAgent || '',
      timestamp: data.timestamp || new Date().toISOString(),
      createdAt: data.createdAt || new Date().toISOString()
    };

    await telegramRepository.createRecord('AUDIT', id, auditRecord, {
      uid: auditRecord.performedBy,
      email: auditRecord.actorEmail
    });

    return auditRecord;
  }

  public static find(_query: any = {}): any {
    const records = telegramRepository.getRecords<IStaffAudit>('AUDIT');
    const sorted = [...records].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const chain = {
      sort: () => chain,
      select: () => chain,
      limit: (n: number) => ({
        lean: async () => sorted.slice(0, n),
        then: (resolve: any, reject?: any) => Promise.resolve(sorted.slice(0, n)).then(resolve, reject)
      }),
      lean: async () => sorted,
      then: (resolve: any, reject?: any) => Promise.resolve(sorted).then(resolve, reject)
    };
    return chain;
  }

  public static async deleteMany(_query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['AUDIT']);
    return { deletedCount: cleared };
  }
}

export default StaffAuditModel;
