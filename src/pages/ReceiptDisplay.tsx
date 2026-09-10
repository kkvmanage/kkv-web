import React from 'react';
import { useApp } from '../context/AppContext';
import { Printer, ArrowLeft, Share2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { KKVLogo } from '../components/common/KKVLogo';

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

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <PageHeader
        title={`Payment Voucher #${receipt.receiptNo}`}
        description={`Receipt issued to ${receipt.customerName} on ${receipt.date}`}
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Receipts', onClick: () => setCurrentPage('all-receipts') },
          { label: `Receipt #${receipt.receiptNo}` }
        ]}
        action={
          <div className="flex items-center gap-2">
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

      {/* Official Printable Voucher Sheet */}
      <div className="max-w-3xl mx-auto bg-white text-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-lg print:shadow-none print:border-none print:m-0 print:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b-2 border-primary-800 gap-4">
          <div className="flex gap-4 items-center">
            <KKVLogo size={56} />
            <div>
              <h1 className="text-xl font-black text-primary-900 tracking-tight m-0">
                KKV GOLD FINANCE
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                MAIN BRANCH — 104 G.S.T Road, Chennai - 600045 | Ph: +91 44 2233 4455
              </p>
              <span className="text-[11px] text-slate-500 font-medium">
                Reg No: TN-CHE-2018-GF492 | GSTIN: 33AAAAA0000A1Z5
              </span>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block bg-primary-100 text-primary-900 font-extrabold text-[11px] px-3 py-1 rounded-md uppercase tracking-wider">
              OFFICIAL PAYMENT VOUCHER
            </span>
            <div className="text-base font-extrabold text-primary-900 mt-2 font-mono">
              RECEIPT #{receipt.receiptNo}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Date: <strong className="text-slate-900">{receipt.date}</strong>
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-slate-200 text-xs">
          <div>
            <div className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
              Received From / Customer Details
            </div>
            <div className="text-base font-black text-slate-900 mt-1">
              {receipt.customerName}
            </div>
            <div className="text-slate-600 mt-0.5">
              Customer ID: <span className="font-semibold text-slate-800">{receipt.customerId}</span>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
              Loan Reference &amp; Type
            </div>
            <div className="text-base font-black text-slate-900 mt-1">
              {receipt.loanNo} — {receipt.loanType}
            </div>
            <div className="text-slate-600 mt-0.5">
              Transaction Kind: <strong className="text-slate-800">{receipt.kind}</strong>
            </div>
          </div>
        </div>

        {/* Amount Breakdown Table */}
        <div className="py-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-center">Payment Mode</th>
                <th className="px-4 py-2.5 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipt.principalComponent > 0 && (
                <tr>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">Principal Repayment Component</div>
                    <div className="text-[11px] text-slate-500">Direct reduction of outstanding loan balance</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {receipt.paymentMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">
                    ₹{receipt.principalComponent.toLocaleString('en-IN')}
                  </td>
                </tr>
              )}

              {receipt.interestComponent > 0 && (
                <tr>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">Monthly Interest Payment</div>
                    <div className="text-[11px] text-slate-500">Pledge interest cleared for the period</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {receipt.paymentMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">
                    ₹{receipt.interestComponent.toLocaleString('en-IN')}
                  </td>
                </tr>
              )}

              {receipt.principalComponent === 0 && receipt.interestComponent === 0 && (
                <tr>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{receipt.kind} Disbursement / Settlement</div>
                    <div className="text-[11px] text-slate-500">{receipt.notes || 'Gold pledge transaction'}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {receipt.paymentMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">
                    ₹{receipt.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              )}

              {/* Total Row */}
              <tr className="bg-primary-50 font-extrabold border-t-2 border-primary-300">
                <td colSpan={2} className="px-4 py-3 text-primary-950 text-sm uppercase tracking-wide">
                  NET RECEIVED TOTAL
                </td>
                <td className="px-4 py-3 text-right text-primary-950 text-base font-black">
                  ₹{receipt.amount.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Reference Details */}
        {(receipt.transactionReference || receipt.bankName || receipt.upiId) && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs flex gap-4 flex-wrap text-slate-700">
            {receipt.bankName && (
              <span><strong>Bank:</strong> {receipt.bankName}</span>
            )}
            {receipt.transactionReference && (
              <span><strong>Ref / UTR:</strong> {receipt.transactionReference}</span>
            )}
            {receipt.upiId && (
              <span><strong>UPI ID:</strong> {receipt.upiId}</span>
            )}
            {receipt.processedBy && (
              <span><strong>Processed By:</strong> {receipt.processedBy}</span>
            )}
          </div>
        )}

        {/* Collateral & Balance Details if available */}
        {associatedLoan && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs space-y-2.5">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span>
                <strong className="text-slate-900">Pledged Gold Collateral:</strong> {associatedLoan.items.map((i) => i.item).join(', ')}
              </span>
              <span>
                <strong className="text-slate-900">Net Wt:</strong> {associatedLoan.totalNetWeight.toFixed(3)} g
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-dashed border-slate-200 flex-wrap gap-2">
              {receipt.outstandingBefore !== undefined && (
                <span>
                  Balance Before: <strong className="text-slate-900">₹{receipt.outstandingBefore.toLocaleString('en-IN')}</strong>
                </span>
              )}
              <span>
                Amount Paid: <strong className="text-primary-700">₹{receipt.amount.toLocaleString('en-IN')}</strong>
              </span>
              <span>
                Remaining Balance: <strong className="text-primary-700">₹{(receipt.outstandingAfter ?? associatedLoan.outstandingPrincipal).toLocaleString('en-IN')}</strong>
              </span>
            </div>

            {/* Pledged Gold Photos Gallery on Voucher */}
            {associatedLoan.photos && associatedLoan.photos.length > 0 && (
              <div className="pt-2 border-t border-dashed border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Pledged Collateral Photos ({associatedLoan.photos.length})
                </div>
                <div className="flex gap-2 flex-wrap">
                  {associatedLoan.photos.map((url, idx) => (
                    <div
                      key={`gold-photo-${idx}`}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white"
                    >
                      <img
                        src={url}
                        alt={`Pledged Gold ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signature Area */}
        <div className="flex justify-between mt-12 pt-4">
          <div className="text-center w-44">
            <div className="border-t border-slate-800 pt-1.5 text-xs font-semibold text-slate-800">
              Customer's Signature
            </div>
          </div>

          <div className="text-center w-52">
            <div className="border-t border-slate-800 pt-1.5 text-xs font-semibold text-slate-800">
              For KKV GOLD FINANCE
              <div className="text-[10px] text-slate-500 font-normal">Authorized Signatory &amp; Seal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
