import { google, sheets_v4 } from 'googleapis';
import { env } from '../config/env.js';
import { googleDriveService } from './googleDrive.service.js';

export interface GoogleSheetsBackupResult {
  success: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  error?: string;
}

export class GoogleSheetsBackupService {
  private sheetsClient: sheets_v4.Sheets | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

      if (!email || !privateKey) {
        console.warn(
          '[GoogleSheetsBackupService] Notice: Google Service Account credentials not fully configured in env.'
        );
        this.isConfigured = false;
        return;
      }

      const auth = new google.auth.JWT({
        email,
        key: privateKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      this.sheetsClient = google.sheets({ version: 'v4', auth });
      this.isConfigured = true;
      console.log(`[GoogleSheetsBackupService] Initialized Google Sheets client for ${email}`);
    } catch (err: any) {
      console.error('[GoogleSheetsBackupService] Failed to initialize Google Sheets client:', err?.message || err);
      this.isConfigured = false;
    }
  }

  public isReady(): boolean {
    return this.isConfigured && this.sheetsClient !== null;
  }

  private getSheets(): sheets_v4.Sheets {
    if (!this.sheetsClient) {
      this.initClient();
    }
    if (!this.sheetsClient) {
      throw new Error(
        'Google Sheets Service is not configured. Please ensure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are set.'
      );
    }
    return this.sheetsClient;
  }

  /**
   * Creates a multi-tab Google Spreadsheet for human-readable audit of the entire database.
   */
  public async exportDatabaseToGoogleSheets(
    backupId: string,
    data: {
      metadata: Record<string, any>;
      customers: any[];
      loans: any[];
      receipts: any[];
      loanPayments: any[];
      goldOrnaments: any[];
      fixedDeposits: any[];
      dayBookEntries: any[];
      rentalComplexes: any[];
      rentalShops: any[];
      rentPayments: any[];
      rentalExpenses: any[];
      rentalDayBook: any[];
      fileAttachments: any[];
    }
  ): Promise<GoogleSheetsBackupResult> {
    if (!this.isReady()) {
      console.warn('[GoogleSheetsBackupService] Google Sheets service not ready. Skipping Sheets export.');
      return { success: false, error: 'Google Sheets Service Account is not configured.' };
    }

    try {
      const sheets = this.getSheets();
      const dateStr = new Date().toISOString().slice(0, 10);
      const title = `KKV GOLD FINANCE - Backup - ${backupId} (${dateStr})`;

      // 1. Create Spreadsheet with tab definitions
      const tabNames = [
        'Summary',
        'Customers',
        'Loans',
        'LoanReceipts',
        'LoanPayments',
        'GoldOrnaments',
        'FixedDeposits',
        'FinanceDayBook',
        'RentalComplexes',
        'RentalShops',
        'RentCollections',
        'RentalExpenses',
        'RentalDayBook',
        'FileAttachments'
      ];

      const createResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title
          },
          sheets: tabNames.map((tab, idx) => ({
            properties: {
              sheetId: idx + 1,
              title: tab,
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }))
        }
      });

      const spreadsheetId = createResponse.data.spreadsheetId;
      const spreadsheetUrl = createResponse.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      if (!spreadsheetId) {
        throw new Error('Failed to obtain spreadsheet ID from Google Sheets API.');
      }

      console.log(`[GoogleSheetsBackupService] 📊 Created Google Spreadsheet: ${title} (${spreadsheetId})`);

      // 2. Populate data into each tab
      const valueData: { range: string; values: any[][] }[] = [];

      // A. Summary Tab
      valueData.push({
        range: 'Summary!A1:B16',
        values: [
          ['Metric / Property', 'Value'],
          ['Backup ID', backupId],
          ['Application', 'KKV GOLD FINANCE & RENTAL MANAGEMENT'],
          ['Created At', new Date().toISOString()],
          ['Created By', data.metadata?.createdBy?.name || 'Administrator'],
          ['Total Customers', data.customers.length],
          ['Total Loans', data.loans.length],
          ['Total Loan Receipts', data.receipts.length],
          ['Total Gold Pledge Ornaments', data.goldOrnaments.length],
          ['Total Fixed Deposits', data.fixedDeposits.length],
          ['Total Rental Complexes', data.rentalComplexes.length],
          ['Total Rental Shops', data.rentalShops.length],
          ['Total Rent Payments', data.rentPayments.length],
          ['Total Rental Expenses', data.rentalExpenses.length],
          ['Total File Attachments', data.fileAttachments.length],
          ['Restore Note', 'NOTE: Google Sheets is for Human-Readable Inspection. Authoritative restore uses the exact ZIP package.']
        ]
      });

      // B. Customers Tab
      const customerRows: any[][] = [
        ['Customer ID', 'Name', 'Mobile', 'Secondary Mobile', 'Email', 'Address', 'City', 'Pincode', 'Aadhaar No', 'PAN No', 'Created At']
      ];
      data.customers.forEach((c) => {
        customerRows.push([
          c.id || c.customerId || '',
          c.name || '',
          c.mobile || '',
          c.secondaryMobile || '',
          c.email || '',
          c.address || '',
          c.city || '',
          c.pincode || '',
          c.aadhaarNumber || c.aadhaarNo || c.kyc?.aadhaarNumber || '',
          c.panNumber || c.panNo || c.kyc?.panNumber || '',
          c.createdAt || ''
        ]);
      });
      valueData.push({ range: 'Customers!A1', values: customerRows });

      // C. Loans Tab
      const loanRows: any[][] = [
        ['Loan No', 'Customer ID', 'Customer Name', 'Principal Amount (₹)', 'Interest Rate (%)', 'Market Value (₹)', 'Gross Weight (g)', 'Net Weight (g)', 'Loan Date', 'Maturity Date', 'Status', 'Total Repaid (₹)']
      ];
      data.loans.forEach((l) => {
        loanRows.push([
          l.loanNo || l.id || '',
          l.customerId || '',
          l.customerName || '',
          l.principalAmount ?? l.principal ?? 0,
          l.interestRate ?? 0,
          l.marketValue ?? 0,
          l.grossWeight ?? 0,
          l.netWeight ?? 0,
          l.loanDate || l.startDate || '',
          l.maturityDate || l.dueDate || '',
          l.status || 'ACTIVE',
          l.totalRepaidAmount ?? l.totalRepaid ?? 0
        ]);
      });
      valueData.push({ range: 'Loans!A1', values: loanRows });

      // D. Receipts Tab
      const receiptRows: any[][] = [
        ['Receipt No', 'Loan No', 'Customer Name', 'Amount (₹)', 'Principal Component (₹)', 'Interest Component (₹)', 'Payment Mode', 'Date', 'Received By', 'Status']
      ];
      data.receipts.forEach((r) => {
        receiptRows.push([
          r.receiptNo || r.id || '',
          r.loanNo || '',
          r.customerName || '',
          r.amount ?? r.totalAmount ?? 0,
          r.principalAmount ?? r.principalPaid ?? 0,
          r.interestAmount ?? r.interestPaid ?? 0,
          r.paymentMode || 'CASH',
          r.date || r.paymentDate || r.createdAt || '',
          r.receivedBy || r.collectedBy || '',
          r.status || 'ACTIVE'
        ]);
      });
      valueData.push({ range: 'LoanReceipts!A1', values: receiptRows });

      // E. Loan Payments Tab
      const paymentRows: any[][] = [
        ['Payment ID', 'Loan No', 'Payment Date', 'Amount (₹)', 'Principal Paid (₹)', 'Interest Paid (₹)', 'Payment Mode', 'Reference No']
      ];
      data.loanPayments.forEach((p) => {
        paymentRows.push([
          p.id || p.paymentId || '',
          p.loanNo || '',
          p.date || p.paymentDate || '',
          p.amount || 0,
          p.principalPaid || 0,
          p.interestPaid || 0,
          p.paymentMode || 'CASH',
          p.referenceNo || ''
        ]);
      });
      valueData.push({ range: 'LoanPayments!A1', values: paymentRows.length > 1 ? paymentRows : [['No loan payments recorded']] });

      // F. Gold Ornaments Tab
      const ornamentRows: any[][] = [
        ['Loan No', 'Item Name', 'Item Type', 'Quantity', 'Gross Weight (g)', 'Net Weight (g)', 'Purity (Carat)', 'Market Value (₹)', 'Remarks']
      ];
      data.goldOrnaments.forEach((o) => {
        ornamentRows.push([
          o.loanNo || o.loanId || '',
          o.itemName || o.name || '',
          o.itemType || '',
          o.quantity || o.qty || 1,
          o.grossWeight || 0,
          o.netWeight || 0,
          o.purity || '22K',
          o.marketValue || 0,
          o.remarks || ''
        ]);
      });
      valueData.push({ range: 'GoldOrnaments!A1', values: ornamentRows.length > 1 ? ornamentRows : [['No ornaments recorded']] });

      // G. Fixed Deposits Tab
      const fdRows: any[][] = [
        ['FD Number', 'Customer Name', 'Deposit Amount (₹)', 'Interest Rate (%)', 'Tenure Months', 'Maturity Amount (₹)', 'Start Date', 'Maturity Date', 'Status']
      ];
      data.fixedDeposits.forEach((fd) => {
        fdRows.push([
          fd.fdNumber || fd.id || '',
          fd.customerName || fd.name || '',
          fd.depositAmount || fd.amount || 0,
          fd.interestRate || 0,
          fd.tenureMonths || 0,
          fd.maturityAmount || 0,
          fd.startDate || '',
          fd.maturityDate || '',
          fd.status || 'ACTIVE'
        ]);
      });
      valueData.push({ range: 'FixedDeposits!A1', values: fdRows.length > 1 ? fdRows : [['No fixed deposits recorded']] });

      // H. Finance DayBook Tab
      const dayBookRows: any[][] = [
        ['Voucher No', 'Date', 'Type', 'Category', 'Description', 'Debit (₹)', 'Credit (₹)', 'Payment Mode', 'Reference ID']
      ];
      data.dayBookEntries.forEach((d) => {
        dayBookRows.push([
          d.voucherNo || d.id || '',
          d.date || '',
          d.transactionType || d.type || '',
          d.category || '',
          d.description || '',
          d.debit || 0,
          d.credit || 0,
          d.paymentMode || '',
          d.referenceId || ''
        ]);
      });
      valueData.push({ range: 'FinanceDayBook!A1', values: dayBookRows.length > 1 ? dayBookRows : [['No day book entries recorded']] });

      // I. Rental Complexes Tab
      const complexRows: any[][] = [
        ['Complex ID', 'Name', 'Address', 'Total Shops', 'Occupied Shops', 'Status', 'Created At']
      ];
      data.rentalComplexes.forEach((c) => {
        complexRows.push([
          c.complexId || c.id || '',
          c.name || '',
          c.address || '',
          c.totalShops || 0,
          c.occupiedShops || 0,
          c.status || 'ACTIVE',
          c.createdAt || ''
        ]);
      });
      valueData.push({ range: 'RentalComplexes!A1', values: complexRows.length > 1 ? complexRows : [['No rental complexes recorded']] });

      // J. Rental Shops Tab
      const shopRows: any[][] = [
        ['Shop ID', 'Complex ID', 'Shop Number', 'Floor', 'Tenant Name', 'Tenant Mobile', 'Monthly Rent (₹)', 'Advance Amount (₹)', 'Status']
      ];
      data.rentalShops.forEach((s) => {
        shopRows.push([
          s.shopId || s.id || '',
          s.complexId || '',
          s.shopNumber || '',
          s.floor || '',
          s.tenantName || '',
          s.tenantMobile || '',
          s.monthlyRent || s.rentAmount || 0,
          s.advanceAmount || 0,
          s.status || 'VACANT'
        ]);
      });
      valueData.push({ range: 'RentalShops!A1', values: shopRows.length > 1 ? shopRows : [['No rental shops recorded']] });

      // K. Rent Collections Tab
      const rentPaymentRows: any[][] = [
        ['Payment ID', 'Shop ID', 'Tenant Name', 'Payment Month', 'Amount (₹)', 'Payment Mode', 'Payment Date', 'Received By']
      ];
      data.rentPayments.forEach((rp) => {
        rentPaymentRows.push([
          rp.paymentId || rp.id || '',
          rp.shopId || '',
          rp.tenantName || '',
          rp.paymentMonth || '',
          rp.amount || rp.paidAmount || 0,
          rp.paymentMode || 'CASH',
          rp.paymentDate || rp.date || '',
          rp.receivedBy || ''
        ]);
      });
      valueData.push({ range: 'RentCollections!A1', values: rentPaymentRows.length > 1 ? rentPaymentRows : [['No rent collections recorded']] });

      // L. Rental Expenses Tab
      const rentalExpenseRows: any[][] = [
        ['Expense ID', 'Complex ID', 'Category', 'Amount (₹)', 'Date', 'Description', 'Payment Mode', 'Paid To']
      ];
      data.rentalExpenses.forEach((re) => {
        rentalExpenseRows.push([
          re.expenseId || re.id || '',
          re.complexId || '',
          re.category || '',
          re.amount || 0,
          re.date || '',
          re.description || '',
          re.paymentMode || 'CASH',
          re.paidTo || ''
        ]);
      });
      valueData.push({ range: 'RentalExpenses!A1', values: rentalExpenseRows.length > 1 ? rentalExpenseRows : [['No rental expenses recorded']] });

      // M. Rental DayBook Tab
      const rentalDbRows: any[][] = [
        ['Voucher No', 'Date', 'Transaction Type', 'Category', 'Description', 'Complex Name', 'Shop Number', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)']
      ];
      data.rentalDayBook.forEach((rdb) => {
        rentalDbRows.push([
          rdb.voucherNo || rdb.id || '',
          rdb.date || '',
          rdb.transactionType || '',
          rdb.category || '',
          rdb.description || '',
          rdb.complexName || '',
          rdb.shopNumber || '',
          rdb.debit || 0,
          rdb.credit || 0,
          rdb.runningBalance || 0
        ]);
      });
      valueData.push({ range: 'RentalDayBook!A1', values: rentalDbRows.length > 1 ? rentalDbRows : [['No rental daybook entries recorded']] });

      // N. File Attachments Tab
      const fileRows: any[][] = [
        ['File ID', 'Entity Type', 'Entity ID', 'Document Type', 'Original File Name', 'MIME Type', 'File Size (Bytes)', 'Drive File ID', 'Created At']
      ];
      data.fileAttachments.forEach((f) => {
        fileRows.push([
          f.fileId || f.id || '',
          f.entityType || '',
          f.entityId || '',
          f.documentType || '',
          f.originalFileName || '',
          f.mimeType || '',
          f.fileSize || 0,
          f.driveFileId || '',
          f.createdAt || ''
        ]);
      });
      valueData.push({ range: 'FileAttachments!A1', values: fileRows.length > 1 ? fileRows : [['No file attachments recorded']] });

      // 3. Batch Update Spreadsheet Values
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: valueData
        }
      });

      // 4. Optionally move spreadsheet into Google Drive System Backups folder
      try {
        if (googleDriveService.isReady()) {
          const rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
          const backupsFolderId = await googleDriveService.getOrCreateFolder('System Backups', rootFolderId);
          const sheetsFolderId = await googleDriveService.getOrCreateFolder('Backup Sheets', backupsFolderId);

          const drive = (googleDriveService as any).getDrive();
          await drive.files.update({
            fileId: spreadsheetId,
            addParents: sheetsFolderId,
            fields: 'id, parents'
          });
          console.log(`[GoogleSheetsBackupService] Moved spreadsheet to Google Drive folder: System Backups/Backup Sheets`);
        }
      } catch (moveErr: any) {
        console.warn('[GoogleSheetsBackupService] Notice: Could not move sheet to subfolder:', moveErr?.message || moveErr);
      }

      console.log(`[GoogleSheetsBackupService] ✅ Google Sheets export completed: ${spreadsheetUrl}`);
      return {
        success: true,
        spreadsheetId,
        spreadsheetUrl
      };
    } catch (err: any) {
      console.error('[GoogleSheetsBackupService] ❌ Google Sheets export failed:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Google Sheets export failed.'
      };
    }
  }
}

export const googleSheetsBackupService = new GoogleSheetsBackupService();
export default googleSheetsBackupService;
