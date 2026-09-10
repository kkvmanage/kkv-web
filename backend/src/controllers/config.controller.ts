import { Request, Response } from 'express';
import { adminService } from '../services/admin.service.js';
import { googleDriveRepository } from '../repositories/googleDrive.repository.js';
import { LoanTypeConfig } from '../types/index.js';

const AUDIT_FILE = 'audit_logs.json';

const recordConfigAuditLog = (
  action: string,
  userId: string,
  loanTypeId: string,
  oldValue: any,
  newValue: any,
  configurationVersion: number
) => {
  try {
    const auditLogs = googleDriveRepository.readJson<any[]>(AUDIT_FILE, []);
    const entry = {
      id: `AUDIT-CONFIG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      userId: userId || 'MASTER_ADMIN',
      loanTypeId,
      oldValue,
      newValue,
      configurationVersion,
      timestamp: new Date().toISOString(),
      user: userId || 'MASTER_ADMIN',
      details: `Loan Type "${loanTypeId}" ${action} to version ${configurationVersion}`
    };
    auditLogs.unshift(entry);
    googleDriveRepository.writeJson(AUDIT_FILE, auditLogs.slice(0, 500));
  } catch (err) {
    console.warn('[AuditLog] Failed to record config audit log:', err);
  }
};

const resolveLoanTypePayload = (t: LoanTypeConfig, settings: any) => {
  const isSilver =
    t.interestProfileId === 'silver-bands' ||
    t.id?.includes('silver') ||
    (t.name || '').toLowerCase().includes('silver');

  const resolvedRate =
    t.useMasterDefaults === false && typeof t.defaultMonthlyRate === 'number'
      ? t.defaultMonthlyRate
      : (t.defaultMonthlyRate || (isSilver ? (settings.silverLoanMonthlyRate ?? 3.0) : (settings.goldLoanMonthlyRate ?? 2.0)) || 2.0);

  const resolvedFee = t.cardFee !== undefined ? t.cardFee : (settings.defaultCardFee ?? 25);
  const resolvedProfile =
    t.interestProfileId === 'silver-bands'
      ? 'Silver Monthly Interest Bands'
      : t.interestProfileId === 'fixed-rate'
      ? `Fixed Rate (${resolvedRate}%/mo)`
      : 'Gold Monthly Interest Bands';

  return {
    ...t,
    cardProcessingFee: resolvedFee,
    cardFee: resolvedFee,
    cardFeeEnabled: t.cardFeeEnabled !== false,
    interestRate: resolvedRate,
    defaultMonthlyRate: resolvedRate,
    interestProfile: resolvedProfile,
    interestProfileName: resolvedProfile,
    status: t.active ? 'ACTIVE' : 'DISABLED',
    issueEnabled: t.showOnLoanIssue !== false,
    configurationVersion: t.configurationVersion || 1
  };
};

export const getLoanTypes = (req: Request, res: Response) => {
  try {
    const settings = adminService.getMasterSettings();
    let list: LoanTypeConfig[] = settings.loanTypes || [];

    const { activeOnly, issueOnly } = req.query;

    if (activeOnly === 'true') {
      list = list.filter((t) => t.active);
    }

    if (issueOnly === 'true') {
      list = list.filter((t) => t.active && t.showOnLoanIssue !== false);
    }

    const enriched = list.map((t) => resolveLoanTypePayload(t, settings));

    return res.json({
      success: true,
      data: enriched,
      count: enriched.length
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getLoanTypeById = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settings = adminService.getMasterSettings();
    const list: LoanTypeConfig[] = settings.loanTypes || [];
    const found = list.find((t) => t.id === id || t.name.toLowerCase() === id.toLowerCase());

    if (!found) {
      return res.status(404).json({ success: false, message: `Loan type "${id}" not found.` });
    }

    return res.json({ success: true, data: resolveLoanTypePayload(found, settings) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createLoanType = (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      active = true,
      showOnLoanIssue = true,
      cardFeeEnabled = true,
      cardFee = 25,
      defaultMonthlyRate = 1.5,
      interestProfileId = 'gold-bands',
      repaymentSystemId = 'monthly-interest-only',
      calculationStrategy = 'MONTHLY_INTEREST_ONLY'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Loan type name is required.' });
    }

    const settings = adminService.getMasterSettings();
    const currentList = settings.loanTypes || [];

    const cleanName = name.trim();
    if (currentList.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      return res.status(400).json({ success: false, message: `Loan type "${cleanName}" already exists.` });
    }

    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'loan-type';
    let id = slug;
    let counter = 1;
    while (currentList.some((t) => t.id === id)) {
      id = `${slug}-${counter++}`;
    }

    const maxSort = currentList.length > 0 ? Math.max(...currentList.map((t) => t.sortOrder || 0)) : 0;
    const now = new Date().toISOString();

    const newItem: LoanTypeConfig = {
      id,
      name: cleanName,
      description: description?.trim() || undefined,
      active: Boolean(active),
      showOnLoanIssue: Boolean(showOnLoanIssue),
      cardFeeEnabled: Boolean(cardFeeEnabled),
      cardFee: Number(cardFee) || 0,
      defaultMonthlyRate: Number(defaultMonthlyRate) || 1.5,
      interestProfileId,
      repaymentSystemId,
      calculationStrategy,
      amountBands: Array.isArray(req.body.amountBands) ? req.body.amountBands : undefined,
      configurationVersion: 1,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now
    };

    const updatedList = [...currentList, newItem];
    adminService.updateMasterSettings({ loanTypes: updatedList });

    const userId = (req as any).user?.id || (req as any).user?.username || 'MASTER_ADMIN';
    recordConfigAuditLog('LOAN_TYPE_CONFIG_CREATED', userId, newItem.id, null, newItem, 1);

    return res.status(201).json({
      success: true,
      data: newItem,
      message: `Loan type "${cleanName}" created successfully.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateLoanType = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const settings = adminService.getMasterSettings();
    const currentList = settings.loanTypes || [];
    const existingIndex = currentList.findIndex((t) => t.id === id);

    if (existingIndex === -1) {
      return res.status(404).json({ success: false, message: `Loan type "${id}" not found.` });
    }

    const existing = currentList[existingIndex];
    const currentVersion = typeof existing.configurationVersion === 'number' ? existing.configurationVersion : 1;

    // Increment configuration version to ensure contractual snapshots for future loans
    const nextVersion = currentVersion + 1;
    const now = new Date().toISOString();

    const updatedItem: LoanTypeConfig = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      description: updates.description !== undefined ? (updates.description.trim() || undefined) : existing.description,
      active: updates.active !== undefined ? Boolean(updates.active) : existing.active,
      showOnLoanIssue: updates.showOnLoanIssue !== undefined ? Boolean(updates.showOnLoanIssue) : (existing.showOnLoanIssue ?? true),
      useMasterDefaults: updates.useMasterDefaults !== undefined ? Boolean(updates.useMasterDefaults) : existing.useMasterDefaults,
      cardFeeEnabled: updates.cardFeeEnabled !== undefined ? Boolean(updates.cardFeeEnabled) : existing.cardFeeEnabled,
      cardFee: updates.cardFee !== undefined ? Number(updates.cardFee) : existing.cardFee,
      defaultMonthlyRate: updates.defaultMonthlyRate !== undefined ? Number(updates.defaultMonthlyRate) : existing.defaultMonthlyRate,
      interestProfileId: updates.interestProfileId !== undefined ? updates.interestProfileId : existing.interestProfileId,
      repaymentSystemId: updates.repaymentSystemId !== undefined ? updates.repaymentSystemId : existing.repaymentSystemId,
      calculationStrategy: updates.calculationStrategy !== undefined ? updates.calculationStrategy : existing.calculationStrategy,
      amountBands: updates.amountBands !== undefined ? updates.amountBands : existing.amountBands,
      configurationVersion: nextVersion,
      updatedAt: now
    };

    const updatedList = [...currentList];
    updatedList[existingIndex] = updatedItem;

    const savedSettings = adminService.updateMasterSettings({ loanTypes: updatedList });

    const userId = (req as any).user?.id || (req as any).user?.username || 'MASTER_ADMIN';
    recordConfigAuditLog('LOAN_TYPE_CONFIG_UPDATED', userId, id, existing, updatedItem, nextVersion);

    return res.json({
      success: true,
      data: resolveLoanTypePayload(updatedItem, savedSettings),
      message: `Loan type "${updatedItem.name}" updated successfully to configuration version ${nextVersion}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleLoanTypeStatus = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const settings = adminService.getMasterSettings();
    const currentList = settings.loanTypes || [];
    const existingIndex = currentList.findIndex((t) => t.id === id);

    if (existingIndex === -1) {
      return res.status(404).json({ success: false, message: `Loan type "${id}" not found.` });
    }

    const existing = currentList[existingIndex];
    const newStatus = typeof active === 'boolean' ? active : !existing.active;

    const updatedItem: LoanTypeConfig = {
      ...existing,
      active: newStatus,
      updatedAt: new Date().toISOString()
    };

    const updatedList = [...currentList];
    updatedList[existingIndex] = updatedItem;

    adminService.updateMasterSettings({ loanTypes: updatedList });

    const userId = (req as any).user?.id || (req as any).user?.username || 'MASTER_ADMIN';
    recordConfigAuditLog('LOAN_TYPE_STATUS_TOGGLED', userId, id, { active: existing.active }, { active: newStatus }, existing.configurationVersion || 1);

    return res.json({
      success: true,
      data: updatedItem,
      message: `Loan type "${existing.name}" status updated to ${newStatus ? 'ACTIVE' : 'DISABLED'}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleLoanTypeVisibility = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { showOnLoanIssue } = req.body;
    const settings = adminService.getMasterSettings();
    const currentList = settings.loanTypes || [];
    const existingIndex = currentList.findIndex((t) => t.id === id);

    if (existingIndex === -1) {
      return res.status(404).json({ success: false, message: `Loan type "${id}" not found.` });
    }

    const existing = currentList[existingIndex];
    const newVisibility = typeof showOnLoanIssue === 'boolean' ? showOnLoanIssue : !(existing.showOnLoanIssue ?? true);

    const updatedItem: LoanTypeConfig = {
      ...existing,
      showOnLoanIssue: newVisibility,
      updatedAt: new Date().toISOString()
    };

    const updatedList = [...currentList];
    updatedList[existingIndex] = updatedItem;

    adminService.updateMasterSettings({ loanTypes: updatedList });

    const userId = (req as any).user?.id || (req as any).user?.username || 'MASTER_ADMIN';
    recordConfigAuditLog('LOAN_TYPE_VISIBILITY_TOGGLED', userId, id, { showOnLoanIssue: existing.showOnLoanIssue }, { showOnLoanIssue: newVisibility }, existing.configurationVersion || 1);

    return res.json({
      success: true,
      data: updatedItem,
      message: `Loan type "${existing.name}" loan issue visibility updated to ${newVisibility ? 'ON' : 'OFF'}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
