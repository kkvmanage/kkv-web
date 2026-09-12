import { Router } from 'express';
import multer from 'multer';
import {
  uploadFileHandler,
  viewFileHandler,
  downloadFileHandler,
  getEntityAttachmentsHandler,
  deleteAttachmentHandler,
  checkDriveHealthHandler
} from '../controllers/file.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = Router();

// Memory storage Multer setup for parsing uploads into RAM buffers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB max file size
  }
});

// Protect all file routes with JWT authentication
router.use(authenticateUser);

// Drive health check
router.get('/health', checkDriveHealthHandler);

// File Upload
router.post('/upload', upload.single('file'), uploadFileHandler);

// View & Download
router.get('/:id/view', viewFileHandler);
router.get('/:id/download', downloadFileHandler);

// Entity attachments listing
router.get('/entity/:entityType/:entityId', getEntityAttachmentsHandler);

// Delete attachment
router.delete('/:id', deleteAttachmentHandler);

export default router;
