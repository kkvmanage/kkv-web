import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, CheckCircle, AlertCircle, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';

export interface DriveFileItem {
  fileId: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  viewUrl?: string;
  downloadUrl?: string;
  driveUrl?: string;
  size?: number;
}

export interface DriveFileUploadProps {
  label?: string;
  accept?: string;
  maxSizeBytes?: number;
  customerId?: string;
  loanId?: string;
  entityType?: string;
  entityId?: string;
  documentType?: string;
  category?: 'profile' | 'kyc' | 'document' | 'receipt' | string;
  folderId?: string;
  files?: DriveFileItem[];
  onUploadSuccess?: (fileItem: DriveFileItem) => void;
  onFileDeleted?: (fileId: string) => void;
  multiple?: boolean;
}

export const DriveFileUpload: React.FC<DriveFileUploadProps> = ({
  label = 'Upload Document',
  accept = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf',
  maxSizeBytes = 10 * 1024 * 1024,
  customerId,
  loanId,
  entityType,
  entityId,
  documentType,
  category = 'document',
  files = [],
  onUploadSuccess,
  onFileDeleted,
  multiple = true
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<DriveFileItem[]>(files);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const file = selectedFiles[0];

    if (file.size > maxSizeBytes) {
      const maxMb = maxSizeBytes / (1024 * 1024);
      setErrorMessage(`File "${file.name}" exceeds maximum allowed size of ${maxMb}MB.`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext || '')) {
      setErrorMessage(`Invalid file format "${ext}". Only JPG, JPEG, PNG, WEBP, and PDF are supported.`);
      return;
    }

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(10);
    setErrorMessage('');
    setSuccessMessage('');

    const resolvedEntityType = entityType || (customerId ? 'customer' : loanId ? 'loan' : category) || 'general';
    const resolvedEntityId = entityId || customerId || loanId || 'general';
    const resolvedDocType = documentType || category || 'document';

    try {
      const result = await apiService.uploadFile(file, {
        entityType: resolvedEntityType,
        entityId: resolvedEntityId,
        documentType: resolvedDocType,
        fileName: file.name,
        onProgress: (pct) => setProgress(pct)
      });

      if (result.success && result.data) {
        const item = result.data;
        const newFile: DriveFileItem = {
          fileId: item.fileId || item.id,
          name: item.originalFileName || file.name,
          mimeType: item.mimeType || file.type,
          viewUrl: apiService.getFileViewUrl(item.viewUrl || `/files/${item.fileId}/view`),
          webViewLink: item.webViewLink || apiService.getFileViewUrl(item.viewUrl || `/files/${item.fileId}/view`),
          downloadUrl: apiService.getFileViewUrl(item.downloadUrl || `/files/${item.fileId}/download`),
          driveUrl: item.driveUrl,
          size: item.fileSize || file.size
        };

        setUploadedFiles((prev) => (multiple ? [...prev, newFile] : [newFile]));
        setSuccessMessage(`Successfully uploaded "${file.name}" to Google Drive`);
        if (onUploadSuccess) onUploadSuccess(newFile);
      } else {
        setErrorMessage(result.message || 'File upload failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred during Google Drive upload.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    if (onFileDeleted) onFileDeleted(fileId);
    try {
      await apiService.deleteFile(fileId);
    } catch {
      // Ignored
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {label && (
        <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
          {label}
        </label>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileSelect(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging ? '2px dashed var(--color-primary-accent)' : '2px dashed var(--border-light)',
          backgroundColor: isDragging ? 'rgba(201, 162, 39, 0.08)' : 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={uploading}
        />

        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
            <Loader2 size={28} color="var(--color-primary-dark)" className="animate-spin" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>
              Processing attachment... {progress}%
            </span>
          </div>
        ) : (
          <>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(201, 162, 39, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UploadCloud size={24} color="var(--color-primary-dark)" />
            </div>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                Click to attach
              </span>{' '}
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>or drag and drop</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              JPG, JPEG, PNG, or PDF (Max 10MB)
            </span>
          </>
        )}
      </div>

      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#dc2626',
            fontSize: '12px',
            fontWeight: 500
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#059669',
            fontSize: '12px',
            fontWeight: 500
          }}
        >
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Attached Files ({uploadedFiles.length})
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadedFiles.map((file) => {
              const isImage = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);
              return (
                <div
                  key={file.fileId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    {isImage ? (
                      <ImageIcon size={18} color="var(--color-primary-accent)" />
                    ) : (
                      <FileText size={18} color="var(--color-primary-dark)" />
                    )}
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--text-dark)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '220px'
                      }}
                      title={file.name}
                    >
                      {file.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(201, 162, 39, 0.1)',
                          color: 'var(--color-primary-dark)',
                          fontSize: '11px',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>View</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(file.fileId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
