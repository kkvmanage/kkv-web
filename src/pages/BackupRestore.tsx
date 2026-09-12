import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download,
  RefreshCw,
  HardDrive,
  FileArchive,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  SendHorizontal
} from 'lucide-react';
import { apiService } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard, StatGrid } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { WipeAllDataModal } from '../components/admin/WipeAllDataModal';
import { SystemRestoreModal } from '../components/admin/SystemRestoreModal';

export const BackupRestore: React.FC = () => {
  const {
    loans,
    customers,
    receipts,
    fixedDeposits,
    dayBookEntries,
    telegramConfig,
    updateTelegramConfig,
    showToast,
    resetAllData
  } = useApp();

  const [botToken, setBotToken] = useState(telegramConfig.botToken || '');
  const [chatId, setChatId] = useState(telegramConfig.chatId || '');
  const [autoBackupOnOpen, setAutoBackupOnOpen] = useState(telegramConfig.autoBackupOnOpen || false);

  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Restore History
  const [restoreHistory, setRestoreHistory] = useState<any[]>([]);
  const [loadingRestoreHistory, setLoadingRestoreHistory] = useState(false);

  // Modals
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  useEffect(() => {
    loadHistory();
    loadRestoreHistory();
  }, []);

  useEffect(() => {
    setBotToken(telegramConfig.botToken || '');
    setChatId(telegramConfig.chatId || '');
    setAutoBackupOnOpen(telegramConfig.autoBackupOnOpen || false);
  }, [telegramConfig]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiService.getBackupHistory();
      if (res.success && Array.isArray(res.data)) {
        setBackupHistory(res.data);
      }
    } catch (err) {
      console.warn('Failed to load backup history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadRestoreHistory = async () => {
    setLoadingRestoreHistory(true);
    try {
      const res = await apiService.getRestoreHistory();
      if (res.success && Array.isArray(res.data)) {
        setRestoreHistory(res.data);
      }
    } catch (err) {
      console.warn('Failed to load restore history:', err);
    } finally {
      setLoadingRestoreHistory(false);
    }
  };

  const handleCreateFullBackup = async () => {
    setCreatingBackup(true);
    showToast('Generating complete authoritative JSON backup...', 'info');
    try {
      const res = await apiService.createBackupPackage();
      if (res.success && res.data) {
        showToast('Full JSON backup created and verified successfully!', 'success');
        loadHistory();
      } else {
        showToast(res.message || 'Failed to create JSON backup', 'error');
      }
    } catch (err: any) {
      showToast(`Backup error: ${err.message}`, 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    showToast('Downloading backup archive...', 'info');
    const res = await apiService.downloadBackup(backupId);
    if (res.success) {
      showToast(`Backup archive downloaded successfully (${res.fileName})`, 'success');
    } else {
      showToast(res.message || 'Backup download failed.', 'error');
    }
  };

  const handleSaveTelegram = () => {
    updateTelegramConfig({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      autoBackupOnOpen
    });
    showToast('Telegram configuration saved!', 'success');
  };

  const handleTestTelegram = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Please enter both Bot Token and Chat ID', 'warning');
      return;
    }
    showToast('Sending test message to Telegram...', 'info');
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: `🔐 *KKV Gold Finance — System Alert*\n\nTelegram backup notifications are successfully configured and active.\n_Time: ${new Date().toLocaleString()}_`,
          parse_mode: 'Markdown'
        })
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Telegram test message delivered successfully!', 'success');
      } else {
        showToast(`Telegram Error: ${data.description}`, 'error');
      }
    } catch (err: any) {
      showToast(`Connection failed: ${err.message}`, 'error');
    }
  };

  const totalOperationalRecords =
    (customers?.length || 0) +
    (loans?.length || 0) +
    (receipts?.length || 0) +
    (fixedDeposits?.length || 0) +
    (dayBookEntries?.length || 0);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <PageHeader
        title="Backup & Disaster Recovery"
        description="Comprehensive data protection suite with portable archives, integrity verification, and atomic restoration."
        breadcrumbs={[{ label: 'Home' }, { label: 'Admin Panel' }, { label: 'Backup & Restore' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />}
            onClick={() => {
              loadHistory();
              loadRestoreHistory();
            }}
          >
            Refresh History
          </Button>
        }
      />

      {/* THREE TOP STAT CARDS */}
      <StatGrid columns={3}>
        <StatCard
          title="Operational Records"
          value={`${totalOperationalRecords.toLocaleString()} Records`}
          subtitle={`Across ${customers?.length || 0} customers, ${loans?.length || 0} loans`}
          icon={<HardDrive className="w-5 h-5 text-indigo-500" />}
          variant="indigo"
        />
        <StatCard
          title="Server Backup Archives"
          value={`${backupHistory.length} Packages`}
          subtitle={backupHistory.length > 0 ? `Latest: ${new Date(backupHistory[0].createdAt).toLocaleDateString()}` : 'No backups generated yet'}
          icon={<FileArchive className="w-5 h-5 text-teal-500" />}
          variant="teal"
        />
        <StatCard
          title="Data Vault Integrity"
          value="Authoritative Storage"
          subtitle="Encrypted Local + Server Mirror"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
          variant="emerald"
        />
      </StatGrid>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: BACKUP MANAGEMENT & RESTORE */}
        <div className="lg:col-span-7 space-y-6">
          {/* CREATE BACKUP CARD */}
          <Card
            title="Create Full JSON Backup"
            subtitle="Generates an authoritative single JSON backup file with Finance, Rental, Sequences, and Drive file references"
          >
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2 mb-4">
              <div className="font-bold text-slate-900 dark:text-white">
                Included in JSON Backup:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                <li>Complete Finance domain (Customers, Loans, Receipts, Payments, Ornaments, Fixed Deposits, Day Book)</li>
                <li>Complete Rental domain (Complexes, Shops, Rent Collections, Expenses, Rental Day Book)</li>
                <li>Attachment metadata &amp; Google Drive file references (no embedded binaries)</li>
                <li>Sequence and counter state for seamless next numbering</li>
                <li>Cryptographic SHA-256 integrity checksum</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="primary"
                icon={creatingBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                disabled={creatingBackup}
                onClick={handleCreateFullBackup}
              >
                {creatingBackup ? 'Creating JSON Backup...' : 'Create Full JSON Backup'}
              </Button>

              <Button
                variant="outline"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => setShowRestoreModal(true)}
              >
                Upload JSON &amp; Restore
              </Button>
            </div>
          </Card>

          {/* BACKUP HISTORY TABLE */}
          <Card
            title="Backup History & Downloads"
            subtitle="Verified server JSON backups available for instant retrieval and restore"
          >
            {loadingHistory ? (
              <div className="text-center py-8 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                <span className="text-xs">Loading backup history...</span>
              </div>
            ) : backupHistory.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                No backup files generated yet. Click "Create Full JSON Backup" above.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {backupHistory.map((b) => (
                  <div
                    key={b.backupId}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs gap-3 flex-wrap"
                  >
                    <div className="min-w-[200px] flex-1">
                      <strong className="text-slate-900 dark:text-white block font-mono text-xs">
                        {b.fileName}
                      </strong>
                      <span className="text-slate-500 text-[11px] mt-0.5 block">
                        {new Date(b.createdAt).toLocaleString()} • {(b.fileSize / 1024).toFixed(1)} KB • {b.recordCounts?.totalRecords || b.totalRecords || 0} records
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() => handleDownloadBackup(b.backupId)}
                      >
                        Download JSON
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* RESTORE AUDIT HISTORY */}
          <Card
            title="Restoration Audit Log"
            subtitle="Historical log of database restorations, rollbacks, and schema integrity validations"
          >
            {loadingRestoreHistory ? (
              <div className="text-center py-8 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                <span className="text-xs">Loading restore logs...</span>
              </div>
            ) : restoreHistory.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                No system restorations recorded in audit log.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {restoreHistory.map((r) => (
                  <div
                    key={r.restoreId}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <strong className="text-slate-900 dark:text-white font-mono">{r.backupFileName || r.restoreId}</strong>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> {r.status || 'VERIFIED'}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Restored by {r.restoredBy || 'Admin'} on {new Date(r.createdAt || r.restoredAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: TELEGRAM + DANGER ZONE */}
        <div className="lg:col-span-5 space-y-6">
          {/* TELEGRAM SETUP */}
          <Card
            title="Telegram Auto-Backup"
            subtitle="Dispatches scheduled database snapshots automatically to your secure Telegram bot channel"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bot Token
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="123456:ABC-DEF..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chat ID / Channel ID
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="-100123456789"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupOnOpen}
                  onChange={(e) => setAutoBackupOnOpen(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Auto-backup snapshot upon application initialization
                </span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<SendHorizontal className="w-4 h-4" />}
                  onClick={handleTestTelegram}
                >
                  Test Dispatch
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveTelegram}
                >
                  Save Configuration
                </Button>
              </div>
            </div>
          </Card>

          {/* DANGER ZONE: WIPE ALL DATA */}
          <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-extrabold m-0">Danger Zone</h3>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              Wipes all operational customer, loan, payment, receipt, and ledger records. Requires creating, downloading, and acknowledging a complete verified backup before destruction.
            </p>

            <Button
              variant="danger"
              icon={<AlertTriangle className="w-4 h-4" />}
              onClick={() => setShowWipeModal(true)}
              className="w-full justify-center"
            >
              Wipe All Operational Data
            </Button>
          </div>
        </div>
      </div>

      {/* FAIL-SAFE WIPE ALL DATA MODAL */}
      <WipeAllDataModal
        isOpen={showWipeModal}
        onClose={() => setShowWipeModal(false)}
        onSuccessReset={() => {
          resetAllData();
          loadHistory();
          loadRestoreHistory();
        }}
        onOpenRestore={() => setShowRestoreModal(true)}
      />

      {/* FAIL-SAFE SYSTEM RESTORE MODAL */}
      <SystemRestoreModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        onSuccessReload={() => {
          resetAllData();
          loadHistory();
          loadRestoreHistory();
        }}
      />
    </div>
  );
};

export default BackupRestore;
