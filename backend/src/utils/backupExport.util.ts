import crypto from 'crypto';

/**
 * Escapes a single CSV cell value according to RFC 4180 rules.
 */
export function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  } else {
    val = String(val);
  }
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Converts an array of uniform objects into an RFC 4180 CSV string.
 */
export function objectsToCsv(rows: Record<string, any>[], explicitHeaders?: string[]): string {
  if (!rows || rows.length === 0) {
    if (explicitHeaders && explicitHeaders.length > 0) {
      return explicitHeaders.map(escapeCsvValue).join(',') + '\r\n';
    }
    return '';
  }

  const headers = explicitHeaders || Array.from(
    new Set(rows.flatMap(r => Object.keys(r || {})))
  );

  const headerLine = headers.map(escapeCsvValue).join(',');
  const lines = [headerLine];

  for (const row of rows) {
    const line = headers.map(h => escapeCsvValue(row[h])).join(',');
    lines.push(line);
  }

  return lines.join('\r\n') + '\r\n';
}

/**
 * Parses an RFC 4180 CSV string back into an array of objects.
 */
export function csvToObjects(csvText: string): Record<string, any>[] {
  if (!csvText || !csvText.trim()) return [];

  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++; // skip \n
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell);
    return cells;
  };

  const headers = parseLine(lines[0]).map(h => h.trim());
  const result: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      let val: any = cells[j] !== undefined ? cells[j] : '';
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try {
          val = JSON.parse(val);
        } catch {
          // keep as string
        }
      } else if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val) && !val.startsWith('0') && val.length < 16) {
        val = Number(val);
      } else if (val === 'true') {
        val = true;
      } else if (val === 'false') {
        val = false;
      }
      obj[headers[j]] = val;
    }
    result.push(obj);
  }

  return result;
}

/**
 * Calculates SHA-256 hash for a given string or Buffer.
 */
export function calculateSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export interface BackupManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface BackupManifest {
  backupId: string;
  applicationName: string;
  applicationVersion: string;
  backupSchemaVersion: string;
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
  recordCounts: {
    customers: number;
    customerKyc?: number;
    loans: number;
    loanPayments?: number;
    loanInterestHistory?: number;
    goldPledgeItems?: number;
    receipts: number;
    fixedDeposits: number;
    fdCustomers?: number;
    fdInterestPayouts?: number;
    fdWithdrawals?: number;
    dayBookEntries: number;
    reminders?: number;
    notifications?: number;
    auditLogs?: number;
    totalRecords: number;
  };
  files: BackupManifestFile[];
  packageSha256?: string;
}

/**
 * Validates a zip entry path against Zip-Slip, directory traversal, absolute paths, and dangerous file types.
 */
export function validateZipEntryPath(rawPath: string): { valid: boolean; reason?: string } {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, reason: 'Empty entry path' };
  }

  // Normalize path separators
  const normalized = rawPath.replace(/\\/g, '/');

  // Directory traversal check (Zip Slip)
  if (normalized.includes('../') || normalized.startsWith('/') || normalized.startsWith('./')) {
    return { valid: false, reason: `Unsafe path traversal detected in entry: ${rawPath}` };
  }

  // Reject executable or dangerous extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.js', '.ts', '.bin', '.dll', '.so'];
  if (dangerousExtensions.some(ext => normalized.toLowerCase().endsWith(ext))) {
    return { valid: false, reason: `Forbidden file type in archive: ${rawPath}` };
  }

  // Expected path prefixes and files
  const allowedPrefixes = [
    'data/',
    'schema/',
    'checksums/',
    'finance/',
    'rental/',
    'attachments/',
    'system/',
    'metadata/',
    'exports/'
  ];
  const allowedRootFiles = ['manifest.json', 'snapshot.json', 'version.json'];

  const isRootFile = allowedRootFiles.includes(normalized);
  const hasAllowedPrefix = allowedPrefixes.some(prefix => normalized.startsWith(prefix) || `${normalized}/`.startsWith(prefix));

  if (!isRootFile && !hasAllowedPrefix) {
    return { valid: false, reason: `Unexpected file path in backup package: ${rawPath}` };
  }

  return { valid: true };
}

/**
 * Validates relational integrity across collections in snapshot data.
 * Checks ID uniqueness and foreign-key references (Customer -> Loan -> Payments/PledgeItems, FD -> Payouts).
 */
export function validateBackupRelationships(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Snapshot data is empty or not an object.'] };
  }

  const customers = Array.isArray(data.customers) ? data.customers : [];
  const loans = Array.isArray(data.loans) ? data.loans : [];
  const receipts = Array.isArray(data.receipts) ? data.receipts : [];
  const fixedDeposits = Array.isArray(data.fixedDeposits) ? data.fixedDeposits : [];
  const fdPayouts = Array.isArray(data.fdInterestPayouts) ? data.fdInterestPayouts : [];

  // 1. Check Customer ID uniqueness
  const customerIdSet = new Set<string>();
  for (const c of customers) {
    const cid = String(c.id || c.customerId || '').trim();
    if (!cid) {
      errors.push('Customer record missing valid ID.');
      continue;
    }
    if (customerIdSet.has(cid)) {
      errors.push(`Duplicate Customer ID found: ${cid}`);
    }
    customerIdSet.add(cid);
  }

  // 2. Check Loan ID uniqueness and Foreign Key (Loan.customerId -> Customer)
  const loanIdSet = new Set<string>();
  for (const l of loans) {
    const lid = String(l.id || l.loanNo || l.loanNumber || '').trim();
    if (!lid) {
      errors.push('Loan record missing valid ID.');
      continue;
    }
    if (loanIdSet.has(lid)) {
      errors.push(`Duplicate Loan ID found: ${lid}`);
    }
    loanIdSet.add(lid);

    // Foreign key validation: customerId
    const custRef = String(l.customerId || l.custId || '').trim();
    if (custRef && customerIdSet.size > 0 && !customerIdSet.has(custRef)) {
      errors.push(`Loan ${lid} references non-existent Customer ID: ${custRef}`);
    }

    // Check financial values validity
    if (l.principal !== undefined && (isNaN(Number(l.principal)) || !isFinite(Number(l.principal)))) {
      errors.push(`Loan ${lid} contains invalid or NaN principal value.`);
    }
  }

  // 3. Check Receipt ID uniqueness and Foreign Key (Receipt.loanId -> Loan if applicable)
  const receiptIdSet = new Set<string>();
  for (const r of receipts) {
    const rid = String(r.id || r.receiptNo || r.receiptNumber || '').trim();
    if (!rid) continue;
    if (receiptIdSet.has(rid)) {
      errors.push(`Duplicate Receipt ID found: ${rid}`);
    }
    receiptIdSet.add(rid);
  }

  // 4. Check Fixed Deposit ID uniqueness and FD Payouts Foreign Key
  const fdIdSet = new Set<string>();
  for (const fd of fixedDeposits) {
    const fdid = String(fd.id || fd.fdNumber || fd.depositNo || '').trim();
    if (!fdid) continue;
    if (fdIdSet.has(fdid)) {
      errors.push(`Duplicate Fixed Deposit ID found: ${fdid}`);
    }
    fdIdSet.add(fdid);
  }

  for (const payout of fdPayouts) {
    const fdRef = String(payout.fdId || payout.depositId || '').trim();
    if (fdRef && fdIdSet.size > 0 && !fdIdSet.has(fdRef)) {
      errors.push(`FD Payout references non-existent Fixed Deposit ID: ${fdRef}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
