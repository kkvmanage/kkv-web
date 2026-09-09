import { Request, Response } from 'express';
import { loanService } from '../services/loan.service.js';
import { receiptService } from '../services/receipt.service.js';

export const getLoans = (req: Request, res: Response) => {
  const loans = loanService.getAll();
  return res.json({
    success: true,
    message: 'Loans retrieved successfully',
    data: loans,
    timestamp: new Date().toISOString()
  });
};

export const getLoanByNo = (req: Request, res: Response) => {
  const loan = loanService.getByLoanNo(req.params.loanNo) || loanService.getById(req.params.loanNo);
  if (!loan) {
    return res.status(404).json({
      success: false,
      message: `Loan ${req.params.loanNo} not found`
    });
  }
  return res.json({
    success: true,
    data: loan
  });
};

export const createLoan = async (req: Request, res: Response) => {
  try {
    const newLoan = await loanService.create(req.body);
    return res.status(201).json({
      success: true,
      message: 'Loan issued successfully',
      data: newLoan
    });
  } catch (err: any) {
    console.error('[LoanController] createLoan error:', err.message || err);
    return res.status(400).json({
      success: false,
      error: err.code || err.error || 'INVALID_REQUEST',
      message: err.message || 'Failed to create loan'
    });
  }
};

export const updateLoan = (req: Request, res: Response) => {
  const updated = loanService.update(req.params.id || req.params.loanNo, req.body);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found'
    });
  }
  return res.json({
    success: true,
    message: 'Loan updated successfully',
    data: updated
  });
};

export const deleteLoan = (req: Request, res: Response) => {
  const deleted = loanService.delete(req.params.id || req.params.loanNo);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Loan not found'
    });
  }
  return res.json({
    success: true,
    message: 'Loan deleted successfully'
  });
};

export const closeLoan = (req: Request, res: Response) => {
  const closedLoan = loanService.closeLoan(req.params.loanNo);
  if (!closedLoan) {
    return res.status(404).json({
      success: false,
      message: `Loan ${req.params.loanNo} not found`
    });
  }
  return res.json({
    success: true,
    message: 'Loan closed successfully',
    data: closedLoan
  });
};

export const getLoanPayments = (req: Request, res: Response) => {
  const loanNo = req.params.id || req.params.loanNo;
  const receipts = receiptService.getAll().filter(r => r.loanNo === loanNo || r.loanId === loanNo);
  return res.json({
    success: true,
    data: receipts
  });
};

export const addLoanPayment = (req: Request, res: Response) => {
  const newReceipt = receiptService.create(req.body);
  return res.status(201).json({
    success: true,
    message: 'Payment recorded successfully',
    data: newReceipt
  });
};
