import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { env } from '../config/env.js';

export interface DriveUploadResult {
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink?: string;
  webContentLink?: string;
  parentFolderId?: string;
}

export interface DriveFolderMapping {
  entityType: string;
  entityId?: string;
  documentType?: string;
}

export interface DriveHealthResult {
  success: boolean;
  configured: boolean;
  authenticated: boolean;
  rootFolderAccessible: boolean;
  rootFolderId: string;
  rootFolderName?: string;
  serviceAccountEmail?: string;
  projectId?: string;
  status: 'connected' | 'unconfigured' | 'error';
  message: string;
  error?: string;
}

export class GoogleDriveService {
  private driveClient: drive_v3.Drive | null = null;
  private folderCache: Map<string, string> = new Map();
  private isConfigured: boolean = false;
  private authError: string | null = null;

  constructor() {
    this.initClient();
  }

  public getRootFolderId(): string {
    return (env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1VfN7XIIeC63bfvkmz4lh8yR_V_b6wViK').trim();
  }

  private initClient(): void {
    try {
      const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
      const rootFolderId = this.getRootFolderId();

      if (!email || !privateKey) {
        const missing: string[] = [];
        if (!email) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
        if (!privateKey) missing.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
        this.authError = `Missing required environment variables: ${missing.join(', ')}`;
        console.warn(`[GoogleDriveService] Notice: Google Service Account credentials not fully configured (${this.authError}).`);
        this.isConfigured = false;
        this.driveClient = null;
        return;
      }

      if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
        this.authError = 'Invalid private key format. Key must contain standard RSA headers.';
        console.error('[GoogleDriveService] Error: Invalid GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY formatting.');
        this.isConfigured = false;
        this.driveClient = null;
        return;
      }

      const auth = new google.auth.JWT({
        email,
        key: privateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      this.driveClient = google.drive({ version: 'v3', auth });
      this.isConfigured = true;
      this.authError = null;
      console.log(`[GoogleDriveService] ✅ Initialized Google Drive client for ${email} (Root Folder: ${rootFolderId})`);
    } catch (err: any) {
      this.authError = err?.message || 'Authentication initialization failed';
      console.error('[GoogleDriveService] Failed to initialize Google Drive client:', this.authError);
      this.isConfigured = false;
      this.driveClient = null;
    }
  }

  public isReady(): boolean {
    if (!this.driveClient) {
      this.initClient();
    }
    return this.isConfigured && this.driveClient !== null;
  }

  private getDrive(): drive_v3.Drive {
    if (!this.driveClient) {
      this.initClient();
    }
    if (!this.driveClient) {
      throw new Error(
        `Google Drive Service is not configured. ${this.authError || 'Please ensure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are set in backend/.env'}`
      );
    }
    return this.driveClient;
  }

  /**
   * Find or create a folder by name inside a parent folder in Google Drive.
   * Results are cached in-memory to prevent repeated API calls.
   * If parentFolderId is omitted, it defaults to the configured root folder.
   */
  public async getOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string> {
    const drive = this.getDrive();
    const targetParentId = parentFolderId || this.getRootFolderId();
    const cacheKey = `${targetParentId}:${folderName}`;

    if (this.folderCache.has(cacheKey)) {
      return this.folderCache.get(cacheKey)!;
    }

    // Search query for existing non-trashed folder inside parent
    const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${targetParentId}' in parents`;

    try {
      const response = await drive.files.list({
        q,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name)'
      });

      if (response.data.files && response.data.files.length > 0) {
        const foundId = response.data.files[0].id!;
        this.folderCache.set(cacheKey, foundId);
        return foundId;
      }

      // If not found, create the folder inside target parent
      const folderMetadata: drive_v3.Schema$File = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [targetParentId]
      };

      const createRes = await drive.files.create({
        requestBody: folderMetadata,
        supportsAllDrives: true,
        fields: 'id, name'
      });

      const newFolderId = createRes.data.id!;
      this.folderCache.set(cacheKey, newFolderId);
      console.log(`[GoogleDriveService] 📁 Created folder "${folderName}" (${newFolderId}) under parent ${targetParentId}`);
      return newFolderId;
    } catch (err: any) {
      console.error(`[GoogleDriveService] Error finding/creating folder "${folderName}":`, err?.message || err);
      throw new Error(`Google Drive folder error for "${folderName}": ${err?.message || err}`);
    }
  }

  /**
   * Resolves the target Google Drive folder ID for an entity and document type.
   * Hierarchical structure under Root Folder (KKV FINANCE):
   * KKV FINANCE
   *   ├── Customers / {customerId}
   *   ├── Loans / {loanNo} / [Ornament Photos]
   *   ├── Receipts
   *   ├── Rental / {Complexes | Shops | Tenants | Expenses | Documents}
   *   ├── System Backups / {Wipe Backups | Full Backups} / {YYYY} / {MM}
   *   └── Other
   */
  public async resolveEntityFolder(mapping: DriveFolderMapping): Promise<string> {
    const rootFolderId = this.getRootFolderId();
    const normalizedEntityType = (mapping.entityType || 'other').toLowerCase().trim();

    if (normalizedEntityType === 'customer' || normalizedEntityType === 'customers') {
      const customersFolderId = await this.getOrCreateFolder('Customers', rootFolderId);
      if (mapping.entityId) {
        return this.getOrCreateFolder(mapping.entityId.trim(), customersFolderId);
      }
      return customersFolderId;
    }

    if (normalizedEntityType === 'loan' || normalizedEntityType === 'loans') {
      const loansFolderId = await this.getOrCreateFolder('Loans', rootFolderId);
      if (mapping.entityId) {
        const loanEntityFolder = await this.getOrCreateFolder(mapping.entityId.trim(), loansFolderId);
        if (mapping.documentType === 'ornament_photo' || mapping.documentType === 'ornaments') {
          return this.getOrCreateFolder('Ornament Photos', loanEntityFolder);
        }
        return loanEntityFolder;
      }
      return loansFolderId;
    }

    if (normalizedEntityType === 'receipt' || normalizedEntityType === 'receipts') {
      return this.getOrCreateFolder('Receipts', rootFolderId);
    }

    if (normalizedEntityType.startsWith('rental')) {
      const rentalFolderId = await this.getOrCreateFolder('Rental', rootFolderId);
      if (normalizedEntityType === 'rental-complex' || normalizedEntityType === 'complex') {
        const compFolder = await this.getOrCreateFolder('Complexes', rentalFolderId);
        return mapping.entityId ? this.getOrCreateFolder(mapping.entityId, compFolder) : compFolder;
      }
      if (normalizedEntityType === 'rental-shop' || normalizedEntityType === 'shop') {
        const shopFolder = await this.getOrCreateFolder('Shops', rentalFolderId);
        return mapping.entityId ? this.getOrCreateFolder(mapping.entityId, shopFolder) : shopFolder;
      }
      if (normalizedEntityType === 'rental-tenant' || normalizedEntityType === 'tenant') {
        const tenantFolder = await this.getOrCreateFolder('Tenants', rentalFolderId);
        return mapping.entityId ? this.getOrCreateFolder(mapping.entityId, tenantFolder) : tenantFolder;
      }
      if (normalizedEntityType === 'rental-expense' || normalizedEntityType === 'expense') {
        return this.getOrCreateFolder('Expenses', rentalFolderId);
      }
      return this.getOrCreateFolder('Documents', rentalFolderId);
    }

    if (normalizedEntityType === 'backup' || normalizedEntityType === 'system_backup') {
      return this.getOrCreateFolder('System Backups', rootFolderId);
    }

    return this.getOrCreateFolder('Other', rootFolderId);
  }

  /**
   * Upload a file buffer directly to Google Drive under a specific folder.
   * If parentFolderId is omitted, it defaults to the configured root folder.
   */
  public async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    parentFolderId?: string
  ): Promise<DriveUploadResult> {
    const drive = this.getDrive();
    const targetParentId = parentFolderId || this.getRootFolderId();

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata: drive_v3.Schema$File = {
      name: filename,
      parents: [targetParentId]
    };

    const media = {
      mimeType,
      body: stream
    };

    try {
      const res = await drive.files.create({
        requestBody: fileMetadata,
        media,
        supportsAllDrives: true,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, parents'
      });

      const fileData = res.data;
      if (!fileData.id) {
        throw new Error('Google Drive upload succeeded but returned no file ID.');
      }

      return {
        fileId: fileData.id,
        name: fileData.name || filename,
        mimeType: fileData.mimeType || mimeType,
        sizeBytes: fileData.size ? parseInt(fileData.size, 10) : buffer.length,
        webViewLink: fileData.webViewLink || undefined,
        webContentLink: fileData.webContentLink || undefined,
        parentFolderId: targetParentId
      };
    } catch (err: any) {
      console.error(`[GoogleDriveService] Failed to upload file "${filename}":`, err?.message || err);
      throw new Error(`Google Drive upload failed: ${err?.message || err}`);
    }
  }

  /**
   * List files within a parent folder.
   */
  public async listFiles(parentFolderId?: string, queryFilter?: string): Promise<drive_v3.Schema$File[]> {
    const drive = this.getDrive();
    const targetParentId = parentFolderId || this.getRootFolderId();
    let q = `'${targetParentId}' in parents and trashed = false`;
    if (queryFilter) {
      q += ` and ${queryFilter}`;
    }

    try {
      const res = await drive.files.list({
        q,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)'
      });
      return res.data.files || [];
    } catch (err: any) {
      console.error(`[GoogleDriveService] Failed to list files in folder ${targetParentId}:`, err?.message || err);
      throw new Error(`Google Drive list failed: ${err?.message || err}`);
    }
  }

  /**
   * Get file metadata from Google Drive.
   */
  public async getFileMetadata(driveFileId: string): Promise<drive_v3.Schema$File> {
    const drive = this.getDrive();
    const res = await drive.files.get({
      fileId: driveFileId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, parents, trashed'
    });
    return res.data;
  }

  /**
   * Get a readable stream for a Google Drive file for streaming to clients.
   */
  public async getFileStream(driveFileId: string): Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    size?: number;
    name?: string;
  }> {
    const drive = this.getDrive();

    const meta = await this.getFileMetadata(driveFileId);
    if (meta.trashed) {
      throw new Error('Requested file has been trashed/deleted in Google Drive.');
    }

    const res = await drive.files.get(
      {
        fileId: driveFileId,
        alt: 'media',
        supportsAllDrives: true
      },
      { responseType: 'stream' }
    );

    return {
      stream: res.data as NodeJS.ReadableStream,
      mimeType: meta.mimeType || 'application/octet-stream',
      size: meta.size ? parseInt(meta.size, 10) : undefined,
      name: meta.name || 'file'
    };
  }

  /**
   * Delete or trash a file in Google Drive.
   */
  public async deleteFile(driveFileId: string, permanent: boolean = true): Promise<boolean> {
    const drive = this.getDrive();
    try {
      if (permanent) {
        await drive.files.delete({
          fileId: driveFileId,
          supportsAllDrives: true
        });
      } else {
        await drive.files.update({
          fileId: driveFileId,
          supportsAllDrives: true,
          requestBody: { trashed: true }
        });
      }
      return true;
    } catch (err: any) {
      console.warn(`[GoogleDriveService] Notice: Error deleting file ${driveFileId}:`, err?.message || err);
      return false;
    }
  }

  /**
   * Comprehensive health check for Google Drive authentication & root folder access.
   */
  public async checkConnection(): Promise<DriveHealthResult> {
    const rootFolderId = this.getRootFolderId();
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const projectId = env.GOOGLE_CLOUD_PROJECT_ID;

    if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return {
        success: false,
        configured: false,
        authenticated: false,
        rootFolderAccessible: false,
        rootFolderId,
        serviceAccountEmail: email,
        projectId,
        status: 'unconfigured',
        message: 'Google Service Account credentials are not configured in backend/.env.',
        error: 'MISSING_CREDENTIALS'
      };
    }

    try {
      const drive = this.getDrive();

      // 1. Verify Drive API Authentication
      const aboutRes = await drive.about.get({ fields: 'user, storageQuota' });
      const userEmail = aboutRes.data.user?.emailAddress || email;

      // 2. Verify Root Folder Accessibility
      let rootFolderName = 'KKV FINANCE';
      let rootAccessible = false;
      try {
        const rootMeta = await drive.files.get({
          fileId: rootFolderId,
          supportsAllDrives: true,
          fields: 'id, name, mimeType, trashed'
        });
        if (rootMeta.data && !rootMeta.data.trashed) {
          rootFolderName = rootMeta.data.name || 'KKV FINANCE';
          rootAccessible = true;
        }
      } catch (rootErr: any) {
        return {
          success: false,
          configured: true,
          authenticated: true,
          rootFolderAccessible: false,
          rootFolderId,
          serviceAccountEmail: userEmail,
          projectId,
          status: 'error',
          message: `Authenticated as ${userEmail}, but root folder (${rootFolderId}) is inaccessible. Please ensure the folder is shared with this service account with Editor access.`,
          error: rootErr?.message || 'ROOT_FOLDER_ACCESS_DENIED'
        };
      }

      return {
        success: true,
        configured: true,
        authenticated: true,
        rootFolderAccessible: rootAccessible,
        rootFolderId,
        rootFolderName,
        serviceAccountEmail: userEmail,
        projectId,
        status: 'connected',
        message: `Google Drive connected successfully. Root folder: "${rootFolderName}" (${rootFolderId}) is accessible.`
      };
    } catch (err: any) {
      return {
        success: false,
        configured: true,
        authenticated: false,
        rootFolderAccessible: false,
        rootFolderId,
        serviceAccountEmail: email,
        projectId,
        status: 'error',
        message: `Google Drive authentication error: ${err?.message || err}`,
        error: err?.message || 'AUTH_FAILURE'
      };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
export default googleDriveService;
