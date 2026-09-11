import React from 'react';
import { useApp } from '../context/AppContext';
import { Printer, ArrowLeft, Share2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { KKVLogo } from '../components/common/KKVLogo';
import '../styles/ReceiptDisplay.css';

export const ReceiptDisplay: React.FC = () => {
  const { selectedReceipt, receipts, loans, setCurrentPage, whatsAppTemplates } = useApp();

  const receipt = selectedReceipt || receipts[0];
  const associatedLoan = loans.find((l) => l.loanNo === receipt?.loanNo);

  const handlePrint = () => {
    window.print();
  };

  if (!receipt) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payment Voucher"
          breadcrumbs={[{ label: 'Home' }, { label: 'Receipts', onClick: () => setCurrentPage('all-receipts') }, { label: 'Voucher' }]}
        />
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto">
          <p className="text-slate-500 mb-4">No receipt selected or found.</p>
          <Button
            variant="primary"
            onClick={() => setCurrentPage('all-receipts')}
          >
            Back to All Receipts
          </Button>
        </div>
      </div>
    );
  }

  const handleWhatsAppShare = () => {
    const rawTemplate = whatsAppTemplates.receiptMessage;
    const msg = rawTemplate
      .replace(/{name}/g, receipt.customerName)
      .replace(/{billNo}/g, receipt.receiptNo.toString())
      .replace(/{loanId}/g, receipt.loanNo)
      .replace(/{amount}/g, receipt.amount.toString())
      .replace(/{date}/g, receipt.date)
      .replace(/{bankName}/g, 'KKV Gold Finance');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const balanceBeforeVal = receipt.outstandingBefore !== undefined
    ? receipt.outstandingBefore
    : (associatedLoan ? associatedLoan.outstandingPrincipal + receipt.amount : receipt.amount);
  const remainingBalanceVal = receipt.outstandingAfter !== undefined
    ? receipt.outstandingAfter
    : (associatedLoan ? associatedLoan.outstandingPrincipal : 0);

  return (
    <div className="receipt-page-wrapper">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="no-print">
        <PageHeader
          title={`Payment Voucher #${receipt.receiptNo}`}
          description={`Receipt issued to ${receipt.customerName} on ${receipt.date}`}
          breadcrumbs={[
            { label: 'Home' },
            { label: 'Receipts', onClick: () => setCurrentPage('all-receipts') },
            { label: `Receipt #${receipt.receiptNo}` }
          ]}
          action={
            <div className="receipt-action-btns">
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => setCurrentPage('all-receipts')}
              >
                Back to Receipts
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                icon={<Share2 className="w-4 h-4 text-emerald-500" />}
                onClick={handleWhatsAppShare}
              >
                WhatsApp Voucher
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}
              >
                Print Voucher
              </Button>
            </div>
          }
        />
      </div>

      {/* Official Financial Payment Voucher */}
      <div className="receipt-voucher">
        {/* Company Header */}
        <div className="rv-header">
          <div className="rv-brand">
            <div className="rv-logo">
              <KKVLogo size={52} />
            </div>
            <div className="rv-company-info">
              <h1>KKV GOLD FINANCE</h1>
              <div className="rv-branch-tag">Main Branch — Gold Loan &amp; Financial Services</div>
              <div className="rv-address">104 G.S.T Road, Chromepet, Chennai - 600045 | Ph: +91 44 2233 4455</div>
              <div className="rv-reg">Reg No: TN-CHE-2018-GF492 | GSTIN: 33AAAAA0000A1Z5</div>
            </div>
          </div>

          <div className="rv-doc-meta">
            <span className="rv-doc-badge">Official Payment Voucher</span>
            <div className="rv-receipt-no">RECEIPT #{receipt.receiptNo}</div>
            <div className="rv-date">Date: <strong>{receipt.date}</strong></div>
          </div>
        </div>

        {/* Customer & Loan Information Grid */}
        <div className="rv-info-grid">
          {/* Customer Details */}
          <div className="rv-info-block">
            <div className="rv-section-title">Customer Details</div>
            <div className="rv-field-row">
              <span className="rv-field-label">Customer Name</span>
              <span className="rv-field-val">{receipt.customerName}</span>
            </div>
            <div className="rv-field-row">
              <span className="rv-field-label">Customer ID</span>
              <span className="rv-field-val">{receipt.customerId}</span>
            </div>
            {associatedLoan?.customerPhone && (
              <div className="rv-field-row">
                <span className="rv-field-label">Contact Phone</span>
                <span className="rv-field-val">{associatedLoan.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Loan Details */}
          <div className="rv-info-block">
            <div className="rv-section-title">Loan Reference</div>
            <div className="rv-field-row">
              <span className="rv-field-label">Loan Reference</span>
              <span className="rv-field-val">{receipt.loanNo}</span>
            </div>
            <div className="rv-field-row">
              <span className="rv-field-label">Loan Type</span>
              <span className="rv-field-val">{receipt.loanType || 'Gold Loan'}</span>
            </div>
            <div className="rv-field-row">
              <span className="rv-field-label">Transaction Kind</span>
              <span className="rv-field-val">{receipt.kind}</span>
            </div>
          </div>
        </div>

        {/* Payment Details Table */}
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead>
              <tr>
                <th className="col-desc">Description</th>
                <th className="col-mode">Payment Mode</th>
                <th className="col-amount">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              {receipt.principalComponent > 0 && (
                <tr>
                  <td className="col-desc">
                    <div className="rv-item-name">Principal Repayment Component</div>
                    <div className="rv-item-sub">Direct reduction of outstanding loan balance</div>
                  </td>
                  <td className="col-mode">
                    <span className="rv-mode-badge">{receipt.paymentMode}</span>
                  </td>
                  <td className="col-amount">
                    <strong>₹{receipt.principalComponent.toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              )}

              {receipt.interestComponent > 0 && (
                <tr>
                  <td className="col-desc">
                    <div className="rv-item-name">Monthly Interest Payment</div>
                    <div className="rv-item-sub">Pledge interest cleared for the billing period</div>
                  </td>
                  <td className="col-mode">
                    <span className="rv-mode-badge">{receipt.paymentMode}</span>
                  </td>
                  <td className="col-amount">
                    <strong>₹{receipt.interestComponent.toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              )}

              {receipt.principalComponent === 0 && receipt.interestComponent === 0 && (
                <tr>
                  <td className="col-desc">
                    <div className="rv-item-name">{receipt.kind} Payment / Settlement</div>
                    <div className="rv-item-sub">{receipt.notes || 'Gold pledge transaction payment'}</div>
                  </td>
                  <td className="col-mode">
                    <span className="rv-mode-badge">{receipt.paymentMode}</span>
                  </td>
                  <td className="col-amount">
                    <strong>₹{receipt.amount.toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              )}

              {/* Total Row */}
              <tr className="rv-total-row">
                <td colSpan={2} className="rv-total-label">
                  Net Received Total
                </td>
                <td className="rv-total-amount">
                  ₹{receipt.amount.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Payment Reference Metadata */}
          {(receipt.transactionReference || receipt.bankName || receipt.upiId || receipt.processedBy) && (
            <div className="rv-tx-strip">
              {receipt.bankName && (
                <div className="rv-tx-strip-item">
                  <span>Bank:</span>
                  <strong>{receipt.bankName}</strong>
                </div>
              )}
              {receipt.transactionReference && (
                <div className="rv-tx-strip-item">
                  <span>Ref / UTR:</span>
                  <strong>{receipt.transactionReference}</strong>
                </div>
              )}
              {receipt.upiId && (
                <div className="rv-tx-strip-item">
                  <span>UPI ID:</span>
                  <strong>{receipt.upiId}</strong>
                </div>
              )}
              {receipt.processedBy && (
                <div className="rv-tx-strip-item">
                  <span>Processed By:</span>
                  <strong>{receipt.processedBy}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collateral & Loan Balance Section */}
        {associatedLoan && (
          <div className="rv-balance-grid">
            {/* Pledged Collateral Summary */}
            <div className="rv-box">
              <div className="rv-box-title">Pledged Collateral Summary</div>
              <div className="rv-balance-row">
                <span className="rv-balance-label">Pledged Items</span>
                <span className="rv-balance-val">
                  {associatedLoan.items?.map((i) => i.item).filter(Boolean).join(', ') || 'Gold Ornaments'}
                </span>
              </div>
              <div className="rv-balance-row">
                <span className="rv-balance-label">Total Net Weight</span>
                <span className="rv-balance-val">
                  {associatedLoan.totalNetWeight?.toFixed(3) ?? '0.000'} g
                </span>
              </div>
              {associatedLoan.marketValue > 0 && (
                <div className="rv-balance-row">
                  <span className="rv-balance-label">Assessed Market Value</span>
                  <span className="rv-balance-val">
                    ₹{associatedLoan.marketValue.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            {/* Loan Account Balance */}
            <div className="rv-box">
              <div className="rv-box-title">Loan Account Balance</div>
              <div className="rv-balance-row">
                <span className="rv-balance-label">Balance Before</span>
                <span className="rv-balance-val">
                  ₹{balanceBeforeVal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="rv-balance-row">
                <span className="rv-balance-label">Amount Paid</span>
                <span className="rv-balance-val" style={{ color: '#047857' }}>
                  ₹{receipt.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="rv-balance-row rv-balance-row--highlight">
                <span className="rv-balance-label" style={{ color: '#0f172a' }}>Remaining Balance</span>
                <span className="rv-balance-val rv-balance-val--primary">
                  ₹{remainingBalanceVal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Signatures Area */}
        <div className="rv-signature-row">
          <div className="rv-sig-block">
            <div className="rv-sig-line">Customer Signature</div>
            <div className="rv-sig-sub">Acknowledged &amp; Verified</div>
          </div>

          <div className="rv-sig-block">
            <div className="rv-sig-line">For KKV GOLD FINANCE</div>
            <div className="rv-sig-sub">Authorized Signatory &amp; Seal</div>
          </div>
        </div>

        {/* System Footer */}
        <div className="rv-footer">
          This is a computer-generated official payment voucher issued by KKV Gold Finance. No signature revision required.
        </div>
      </div>
    </div>
  );
};
