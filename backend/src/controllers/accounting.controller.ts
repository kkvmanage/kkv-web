import { Request, Response } from 'express';
import { accountingService } from '../services/accounting.service.js';

export const getDayBook = async (req: Request, res: Response) => {
  const entries = await accountingService.getDayBookAsync();
  return res.json({
    success: true,
    data: entries
  });
};

export const addVoucher = async (req: Request, res: Response) => {
  const entry = await accountingService.addEntryAsync(req.body);
  return res.status(201).json({
    success: true,
    message: 'Voucher recorded successfully',
    data: entry
  });
};

export const getBalances = async (req: Request, res: Response) => {
  const balances = await accountingService.getBalancesAsync();
  return res.json({
    success: true,
    data: balances
  });
};

export const getTrialBalance = async (req: Request, res: Response) => {
  const tb = await accountingService.getTrialBalance();
  return res.json({
    success: true,
    data: tb
  });
};

export const getProfitAndLoss = async (req: Request, res: Response) => {
  const pl = await accountingService.getProfitAndLoss();
  return res.json({
    success: true,
    data: pl
  });
};

export const getBalanceSheet = async (req: Request, res: Response) => {
  const bs = await accountingService.getBalanceSheet();
  return res.json({
    success: true,
    data: bs
  });
};
