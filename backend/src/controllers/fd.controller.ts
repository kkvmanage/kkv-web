import { Request, Response } from 'express';
import { fdService } from '../services/fd.service.js';
import { adminService } from '../services/admin.service.js';

export const getFDCustomers = async (req: Request, res: Response) => {
  const customers = await fdService.getCustomersAsync();
  return res.json({
    success: true,
    data: customers
  });
};

export const createFDCustomer = async (req: Request, res: Response) => {
  try {
    const newCust = await fdService.createCustomer(req.body);
    return res.status(201).json({
      success: true,
      message: 'FD Customer created',
      data: newCust
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create FD customer'
    });
  }
};

export const getFixedDeposits = async (req: Request, res: Response) => {
  const deposits = await fdService.getDepositsAsync();
  return res.json({
    success: true,
    data: deposits
  });
};

export const createFixedDeposit = async (req: Request, res: Response) => {
  try {
    const newFD = await fdService.createDeposit(req.body);
    return res.status(201).json({
      success: true,
      message: 'Fixed Deposit created',
      data: newFD
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create Fixed Deposit'
    });
  }
};

export const payFDInterest = async (req: Request, res: Response) => {
  const { amount, mode, dueDate, periodKey } = req.body;
  const payout = await fdService.payInterest(req.params.fdNo, Number(amount), mode, dueDate, periodKey);
  if (!payout) {
    return res.status(404).json({ success: false, message: `FD ${req.params.fdNo} not found` });
  }
  return res.json({
    success: true,
    message: 'FD interest payout recorded',
    data: payout
  });
};

export const withdrawFD = async (req: Request, res: Response) => {
  const { mode, notes, withdrawalAmount, transactionReference, bankName } = req.body;
  const withdrawal = await fdService.withdraw(
    req.params.fdNo,
    mode,
    notes,
    withdrawalAmount ? Number(withdrawalAmount) : undefined,
    transactionReference,
    bankName
  );
  if (!withdrawal) {
    return res.status(404).json({ success: false, message: `FD ${req.params.fdNo} not found or already closed` });
  }
  return res.json({
    success: true,
    message: 'FD withdrawn successfully',
    data: withdrawal
  });
};

export const renewFD = async (req: Request, res: Response) => {
  const { periodMonths, notes } = req.body;
  const renewal = await fdService.renew(req.params.fdNo, Number(periodMonths) || 12, notes);
  if (!renewal) {
    return res.status(400).json({ success: false, message: `FD ${req.params.fdNo} cannot be renewed` });
  }
  return res.json({
    success: true,
    message: 'FD renewed successfully',
    data: renewal
  });
};

export const deleteFixedDeposit = async (req: Request, res: Response) => {
  const deleted = await fdService.deleteDeposit(req.params.fdNo);
  if (!deleted) {
    return res.status(404).json({ success: false, message: `FD ${req.params.fdNo} not found` });
  }
  return res.json({
    success: true,
    message: 'FD deleted successfully'
  });
};

export const getFDPayouts = async (req: Request, res: Response) => {
  const payouts = await fdService.getPayoutsAsync();
  return res.json({
    success: true,
    data: payouts
  });
};

export const getFDWithdrawals = async (req: Request, res: Response) => {
  const withdrawals = await fdService.getWithdrawalsAsync();
  return res.json({
    success: true,
    data: withdrawals
  });
};

export const getFDRenewals = async (req: Request, res: Response) => {
  const renewals = await fdService.getRenewalsAsync();
  return res.json({
    success: true,
    data: renewals
  });
};

export const bulkUpdateFDDates = (req: Request, res: Response) => {
  const { fdNos, newDepositDate, offsetDays } = req.body;
  if (!fdNos || !Array.isArray(fdNos) || fdNos.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or empty fdNos array' });
  }
  const updated = fdService.bulkUpdateDates(fdNos, newDepositDate, offsetDays !== undefined ? Number(offsetDays) : undefined);
  return res.json({
    success: true,
    message: `Updated ${updated.length} Fixed Deposits`,
    data: updated
  });
};

export const getFDConfiguration = (req: Request, res: Response) => {
  const master = adminService.getMasterSettings();
  const fdConfig = {
    fdInterestRate: master.fdInterestRate ?? 12,
    fdInterestRateEffectiveFrom: master.fdInterestRateEffectiveFrom ?? '01-08-2026',
    fdInterestRateHistory: master.fdInterestRateHistory ?? [],
    fdDefaultTenureMonths: master.fdDefaultTenureMonths ?? 12,
    fdAllowedTenures: master.fdAllowedTenures ?? [6, 12, 24, 36, 60],
    fdMinimumAmount: master.fdMinimumAmount ?? 5000,
    fdMaximumAmount: master.fdMaximumAmount ?? 10000000,
    fdPayoutFrequency: master.fdPayoutFrequency ?? 'Monthly',
    fdAllowedReceivingMethods: master.fdAllowedReceivingMethods ?? ['Cash', 'Bank', 'UPI'],
    fdLockinPeriodMonths: master.fdLockinPeriodMonths ?? 3,
    fdRenewalPolicy: master.fdRenewalPolicy ?? 'MANUAL',
    fdCalculationMethod: master.fdCalculationMethod ?? 'MONTHLY_DIVIDEND',
    configurationVersion: master.configurationVersion ?? 1
  };

  return res.json({
    success: true,
    data: fdConfig
  });
};

export const updateFDConfiguration = (req: Request, res: Response) => {
  const userRole = (req.headers['user-role'] as string) || req.body?.userRole || req.query?.userRole || 'OPERATOR';
  const isMasterAdmin = userRole === 'MASTER_ADMIN' || userRole === 'ADMIN';

  if (!isMasterAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only Master Admin has permission to modify Fixed Deposit configuration'
    });
  }

  // Validate FD parameters
  if (req.body.fdInterestRate !== undefined) {
    const rate = Number(req.body.fdInterestRate);
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      return res.status(400).json({ success: false, message: 'FD Interest Rate must be a valid positive percentage between 0 and 100.' });
    }
  }

  if (req.body.fdDefaultTenureMonths !== undefined) {
    const tenure = Number(req.body.fdDefaultTenureMonths);
    if (isNaN(tenure) || tenure < 1) {
      return res.status(400).json({ success: false, message: 'FD Default Tenure must be at least 1 month.' });
    }
  }

  if (req.body.fdMinimumAmount !== undefined) {
    const minAmt = Number(req.body.fdMinimumAmount);
    if (isNaN(minAmt) || minAmt < 0) {
      return res.status(400).json({ success: false, message: 'FD Minimum Amount cannot be negative.' });
    }
  }

  if (req.body.fdMaximumAmount !== undefined && req.body.fdMinimumAmount !== undefined) {
    if (Number(req.body.fdMaximumAmount) < Number(req.body.fdMinimumAmount)) {
      return res.status(400).json({ success: false, message: 'FD Maximum Amount cannot be less than Minimum Amount.' });
    }
  }

  const updatedMaster = adminService.updateMasterSettings({
    fdInterestRate: req.body.fdInterestRate !== undefined ? Number(req.body.fdInterestRate) : undefined,
    fdInterestRateEffectiveFrom: req.body.fdInterestRateEffectiveFrom,
    fdDefaultTenureMonths: req.body.fdDefaultTenureMonths !== undefined ? Number(req.body.fdDefaultTenureMonths) : undefined,
    fdAllowedTenures: req.body.fdAllowedTenures,
    fdMinimumAmount: req.body.fdMinimumAmount !== undefined ? Number(req.body.fdMinimumAmount) : undefined,
    fdMaximumAmount: req.body.fdMaximumAmount !== undefined ? Number(req.body.fdMaximumAmount) : undefined,
    fdPayoutFrequency: req.body.fdPayoutFrequency,
    fdAllowedReceivingMethods: req.body.fdAllowedReceivingMethods,
    fdLockinPeriodMonths: req.body.fdLockinPeriodMonths !== undefined ? Number(req.body.fdLockinPeriodMonths) : undefined,
    fdRenewalPolicy: req.body.fdRenewalPolicy,
    fdCalculationMethod: req.body.fdCalculationMethod,
    ...(req.body.changedBy ? { changedBy: req.body.changedBy } : {}),
    ...(req.body.notes ? { notes: req.body.notes } : {})
  } as any);

  return res.json({
    success: true,
    message: 'Fixed Deposit configuration updated successfully',
    data: updatedMaster
  });
};
