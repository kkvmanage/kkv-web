import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFileAttachment extends Document {
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
  deletedAt?: Date | null;
  deletedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const FileAttachmentSchema = new Schema<IFileAttachment>(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    entityId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    documentType: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true
    },
    storedFileName: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0
    },
    driveFileId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    driveFolderId: {
      type: String,
      trim: true
    },
    driveUrl: {
      type: String,
      trim: true
    },
    webViewLink: {
      type: String,
      trim: true
    },
    webContentLink: {
      type: String,
      trim: true
    },
    uploadedBy: {
      type: String,
      trim: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'file_attachments'
  }
);

// Compound index for querying attachments by entity
FileAttachmentSchema.index({ entityType: 1, entityId: 1, isDeleted: 1 });
FileAttachmentSchema.index({ entityType: 1, documentType: 1, isDeleted: 1 });

export const FileAttachmentModel: Model<IFileAttachment> =
  mongoose.models.FileAttachment || mongoose.model<IFileAttachment>('FileAttachment', FileAttachmentSchema);

export default FileAttachmentModel;
