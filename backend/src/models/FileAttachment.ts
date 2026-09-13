import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IFileAttachment {
  _id?: string;
  id?: string;
  fileId: string;
  entityType: string;
  entityId: string;
  documentType: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  driveFileId: string;
  driveFolderId?: string;
  driveUrl?: string;
  webViewLink?: string;
  webContentLink?: string;
  uploadedBy?: string;
  isDeleted: boolean;
  deletedAt?: Date | string | null;
  deletedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class FileAttachmentModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<IFileAttachment>('FILE_ATTACHMENT', { includeDeleted });

    if (query.entityId) {
      records = records.filter((f) => f.entityId === query.entityId);
    }
    if (query.entityType) {
      records = records.filter((f) => f.entityType === query.entityType);
    }
    if (query.fileId) {
      records = records.filter((f) => f.fileId === query.fileId);
    }

    const chain = {
      sort: () => chain,
      select: () => chain,
      lean: async () => records,
      then: (resolve: any, reject?: any) => Promise.resolve(records).then(resolve, reject)
    };
    return chain;
  }

  public static findOne(query: any = {}): any {
    const records = telegramRepository.getRecords<IFileAttachment>('FILE_ATTACHMENT');
    let match: IFileAttachment | null = null;
    if (query.fileId) {
      match = records.find((f) => f.fileId === query.fileId) || null;
    }

    const chain = {
      select: () => chain,
      lean: async () => match,
      then: (resolve: any, reject?: any) => Promise.resolve(match).then(resolve, reject)
    };
    return chain;
  }

  public static async create(data: Partial<IFileAttachment>): Promise<IFileAttachment> {
    const id = data.fileId || `FILE-${Date.now()}`;
    const doc: IFileAttachment = {
      fileId: id,
      entityType: data.entityType || 'GENERAL',
      entityId: data.entityId || 'NONE',
      documentType: data.documentType || 'DOCUMENT',
      originalFileName: data.originalFileName || 'file',
      storedFileName: data.storedFileName || 'file',
      mimeType: data.mimeType || 'application/octet-stream',
      fileSize: data.fileSize || 0,
      driveFileId: data.driveFileId || '',
      driveFolderId: data.driveFolderId,
      driveUrl: data.driveUrl,
      webViewLink: data.webViewLink,
      webContentLink: data.webContentLink,
      uploadedBy: data.uploadedBy,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await telegramRepository.createRecord('FILE_ATTACHMENT', id, doc);
    return doc;
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    return telegramRepository.countRecords('FILE_ATTACHMENT', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['FILE_ATTACHMENT']);
    return { deletedCount: cleared };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.fileId || d.id || `FILE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const res = await telegramRepository.createRecord('FILE_ATTACHMENT', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default FileAttachmentModel;
