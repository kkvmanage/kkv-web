import { Request, Response } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileAttachmentModel } from '../models/FileAttachment.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { storageService } from '../services/storage.service.js';
import { isMongoConnected, ensureMongoConnected } from '../config/database.js';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOC_MIMES = ['application/pdf'];
const ALL_ALLOWED_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_DOC_MIMES];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Sanitizes entity IDs and filenames to safe alphanumeric tokens
 */
function sanitizeIdentifier(input?: string): string {
  if (!input) return 'general';
  return input.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

/**
 * Derives a clean extension
 */
function getExtensionFromMimeOrName(originalName: string, mimeType: string): string {
  if (originalName && originalName.includes('.')) {
    const ext = path.extname(originalName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)) {
      return ext;
    }
  }
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default:
      return '.bin';
  }
}

/**
 * POST /api/files/upload
 * Handles multipart file upload, validates payload, stores in Google Drive, and saves metadata in MongoDB.
 */
export const uploadFileHandler = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was provided in the upload request. Please select a file.'
      });
    }

    const file = req.file;
    const body = req.body || {};

    const entityType = (body.entityType || 'general').toLowerCase().trim();
    const entityId = sanitizeIdentifier(body.entityId || 'general');
    const documentType = (body.documentType || 'document').toLowerCase().trim();
    const uploadedBy = (req as any).user?.email || (req as any).user?.id || 'STAFF';

    const mimeType = (file.mimetype || 'application/octet-stream').toLowerCase();
    const originalName = file.originalname || 'uploaded_file';

    // File type validation
    if (!ALL_ALLOWED_MIMES.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported file format "${mimeType}". Only JPG, PNG, WEBP, and PDF files are allowed.`
      });
    }

    // File size validation
    const isImage = ALLOWED_IMAGE_MIMES.includes(mimeType);
    const maxAllowedSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_DOC_SIZE_BYTES;

    if (file.size > maxAllowedSize) {
      const maxMb = maxAllowedSize / (1024 * 1024);
      return res.status(400).json({
        success: false,
        message: `File size exceeds the allowed limit of ${maxMb}MB for this file type.`
      });
    }

    const ext = getExtensionFromMimeOrName(originalName, mimeType);
    const uniqueSuffix = uuidv4().substring(0, 8);
    const storedFileName = `${entityId}_${documentType}_${uniqueSuffix}${ext}`;
    const fileId = `FILE_${Date.now()}_${uniqueSuffix}`;

    // Upload to Google Drive (with graceful local storage fallback if Drive is offline in dev)
    let driveFileId = '';
    let driveFolderId = '';
    let driveUrl = '';
    let webViewLink = '';
    let webContentLink = '';

    if (googleDriveService.isReady()) {
      try {
        const targetFolderId = await googleDriveService.resolveEntityFolder({
          entityType,
          entityId,
          documentType
        });

        const driveResult = await googleDriveService.uploadBuffer(
          file.buffer,
          storedFileName,
          mimeType,
          targetFolderId
        );

        driveFileId = driveResult.fileId;
        driveFolderId = targetFolderId;
        driveUrl = driveResult.webViewLink || `https://drive.google.com/file/d/${driveResult.fileId}/view`;
        webViewLink = driveResult.webViewLink || '';
        webContentLink = driveResult.webContentLink || '';
      } catch (driveErr: any) {
        console.error('[FileController] Google Drive upload failed:', driveErr?.message || driveErr);
        return res.status(502).json({
          success: false,
          message: `Google Drive storage service error: ${driveErr?.message || 'Upload failed'}`
        });
      }
    } else {
      // In local dev without credentials, store in local storage service and generate local fileId
      console.warn('[FileController] Notice: Google Drive credentials not configured. Using local storage buffer.');
      const localResult = await storageService.saveFile(file.buffer, {
        category: entityType as any,
        mimeType,
        originalName: storedFileName
      });
      driveFileId = `local_${localResult.fileId}`;
      driveUrl = `/api/files/${fileId}/view`;
    }

    // Persist FileAttachment metadata in MongoDB
    if (!isMongoConnected()) {
      await ensureMongoConnected();
    }

    let savedAttachment: any = null;
    if (isMongoConnected()) {
      try {
        savedAttachment = await FileAttachmentModel.create({
          fileId,
          entityType,
          entityId,
          documentType,
          originalFileName: originalName,
          storedFileName,
          mimeType,
          fileSize: file.size,
          driveFileId,
          driveFolderId,
          driveUrl,
          webViewLink,
          webContentLink,
          uploadedBy,
          isDeleted: false
        });
      } catch (dbErr: any) {
        console.error('[FileController] Failed to save metadata to MongoDB:', dbErr?.message || dbErr);
        // Clean up uploaded drive file to prevent orphaned storage
        if (driveFileId && !driveFileId.startsWith('local_')) {
          googleDriveService.deleteFile(driveFileId, true).catch(() => {});
        }
        return res.status(500).json({
          success: false,
          message: 'Failed to save file metadata to database.'
        });
      }
    }

    const viewUrl = `/api/files/${fileId}/view`;
    const downloadUrl = `/api/files/${fileId}/download`;

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully to Google Drive.',
      data: {
        fileId,
        id: fileId,
        driveFileId,
        entityType,
        entityId,
        documentType,
        originalFileName: originalName,
        storedFileName,
        mimeType,
        fileSize: file.size,
        viewUrl,
        downloadUrl,
        driveUrl,
        webViewLink,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('[FileController] uploadFileHandler unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'An unexpected error occurred during file upload.'
    });
  }
};

/**
 * GET /api/files/:id/view
 * Streams file securely from Google Drive with inline Content-Disposition for browser display.
 */
export const viewFileHandler = async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;

    if (!isMongoConnected()) {
      await ensureMongoConnected();
    }

    // Look up attachment metadata
    let attachment: any = null;
    if (isMongoConnected()) {
      attachment = await FileAttachmentModel.findOne({
        $or: [{ fileId: targetId }, { driveFileId: targetId }],
        isDeleted: { $ne: true }
      }).lean();
    }

    const driveFileId = attachment ? attachment.driveFileId : targetId;

    // Stream from Google Drive
    if (driveFileId && !driveFileId.startsWith('local_') && googleDriveService.isReady()) {
      try {
        const { stream, mimeType, size, name } = await googleDriveService.getFileStream(driveFileId);

        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name || 'file')}"`);
        if (size) res.setHeader('Content-Length', size);
        res.setHeader('Cache-Control', 'private, max-age=86400');

        return stream.pipe(res);
      } catch (driveErr: any) {
        console.error('[FileController] Google Drive streaming error:', driveErr?.message || driveErr);
        return res.status(404).json({
          success: false,
          message: 'Requested file could not be retrieved from Google Drive.'
        });
      }
    }

    // Fallback: Local storage check
    if (attachment && attachment.storedFileName) {
      const relPath = path.join(attachment.entityType || 'general', attachment.storedFileName);
      if (storageService.fileExists(relPath)) {
        const { buffer } = await storageService.getFile(relPath);
        res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`);
        return res.send(buffer);
      }
    }

    return res.status(404).json({
      success: false,
      message: 'File attachment not found.'
    });
  } catch (err: any) {
    console.error('[FileController] viewFileHandler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve file.'
    });
  }
};

/**
 * GET /api/files/:id/download
 * Streams file with attachment Content-Disposition to trigger browser download.
 */
export const downloadFileHandler = async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;

    if (!isMongoConnected()) {
      await ensureMongoConnected();
    }

    let attachment: any = null;
    if (isMongoConnected()) {
      attachment = await FileAttachmentModel.findOne({
        $or: [{ fileId: targetId }, { driveFileId: targetId }],
        isDeleted: { $ne: true }
      }).lean();
    }

    const driveFileId = attachment ? attachment.driveFileId : targetId;
    const downloadName = attachment?.originalFileName || 'downloaded_file';

    if (driveFileId && !driveFileId.startsWith('local_') && googleDriveService.isReady()) {
      const { stream, mimeType, size } = await googleDriveService.getFileStream(driveFileId);

      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
      if (size) res.setHeader('Content-Length', size);

      return stream.pipe(res);
    }

    return res.status(404).json({
      success: false,
      message: 'File attachment not found for download.'
    });
  } catch (err: any) {
    console.error('[FileController] downloadFileHandler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to download file.'
    });
  }
};

/**
 * GET /api/files/entity/:entityType/:entityId
 * Returns list of attachments for a specific business entity (e.g. customer, loan).
 */
export const getEntityAttachmentsHandler = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    if (!isMongoConnected()) {
      await ensureMongoConnected();
    }

    if (!isMongoConnected()) {
      return res.json({ success: true, data: [] });
    }

    const attachments = await FileAttachmentModel.find({
      entityType: entityType.toLowerCase().trim(),
      entityId: sanitizeIdentifier(entityId),
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .lean();

    const mapped = attachments.map((att: any) => ({
      ...att,
      viewUrl: `/api/files/${att.fileId}/view`,
      downloadUrl: `/api/files/${att.fileId}/download`
    }));

    return res.json({
      success: true,
      data: mapped,
      count: mapped.length
    });
  } catch (err: any) {
    console.error('[FileController] getEntityAttachmentsHandler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve entity attachments.'
    });
  }
};

/**
 * DELETE /api/files/:id
 * Deletes or trashes a file attachment.
 */
export const deleteAttachmentHandler = async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const user = (req as any).user;
    const isAdmin = user?.role === 'ADMIN';

    if (!isMongoConnected()) {
      await ensureMongoConnected();
    }

    const attachment = await FileAttachmentModel.findOne({
      $or: [{ fileId: targetId }, { driveFileId: targetId }]
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'File attachment not found.'
      });
    }

    // Mark deleted in MongoDB
    attachment.isDeleted = true;
    attachment.deletedAt = new Date();
    attachment.deletedBy = user?.email || user?.id || 'USER';
    await attachment.save();

    // Trash in Google Drive if configured
    if (attachment.driveFileId && !attachment.driveFileId.startsWith('local_')) {
      googleDriveService.deleteFile(attachment.driveFileId, isAdmin).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Attachment deleted successfully.'
    });
  } catch (err: any) {
    console.error('[FileController] deleteAttachmentHandler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete attachment.'
    });
  }
};

/**
 * GET /api/files/health
 * Checks Google Drive connection status
 */
export const checkDriveHealthHandler = async (_req: Request, res: Response) => {
  const result = await googleDriveService.checkConnection();
  return res.status(result.success ? 200 : 503).json(result);
};
