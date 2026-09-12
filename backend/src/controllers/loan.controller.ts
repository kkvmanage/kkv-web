import { Request, Response } from 'express';
import { loanService } from '../services/loan.service.js';
import { receiptService } from '../services/receipt.service.js';
import { counterService } from '../services/counter.service.js';

export const getNextSequence = async (req: Request, res: Response) => {
  try {
    const nextSeq = await counterService.peekNextLoanSequence();
    return res.json({
      success: true,
      data: {
        nextSequence: nextSeq,
        loanNo: `GL-${nextSeq}`,
        receiptNo: nextSeq
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve next sequence',
      error: err.message
    });
  }
};

export const getLoans = async (req: Request, res: Response) => {
  const loans = await loanService.getAllAsync();
  return res.json({
    success: true,
    message: 'Loans retrieved successfully',
    data: loans,
    timestamp: new Date().toISOString()
  });
};

export const getLoanByNo = async (req: Request, res: Response) => {
  const loan = (await loanService.getByLoanNoAsync(req.params.loanNo)) || (await loanService.getByIdAsync(req.params.loanNo));
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

export const updateLoan = async (req: Request, res: Response) => {
  const updated = await loanService.updateAsync(req.params.id || req.params.loanNo, req.body);
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

export const deleteLoan = async (req: Request, res: Response) => {
  const deleted = await loanService.deleteAsync(req.params.id || req.params.loanNo);
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

export const closeLoan = async (req: Request, res: Response) => {
  const closedLoan = await loanService.closeLoanAsync(req.params.loanNo);
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

export const getLoanPayments = async (req: Request, res: Response) => {
  const loanNo = req.params.id || req.params.loanNo;
  const receipts = (await receiptService.getAllAsync()).filter(r => r.loanNo === loanNo || r.loanId === loanNo);
  return res.json({
    success: true,
    data: receipts
  });
};

export const addLoanPayment = async (req: Request, res: Response) => {
  try {
    const newReceipt = await receiptService.create(req.body);
    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: newReceipt
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to add payment'
    });
  }
};

export const getLoansByCustomerId = async (req: Request, res: Response) => {
  const customerId = req.params.customerId || req.params.id;
  const allLoans = await loanService.getAllAsync();
  const customerLoans = allLoans.filter(l => 
    l.customerId === customerId || 
    (l as any).customerId?.toString() === customerId ||
    l.customerId?.toLowerCase() === customerId?.toLowerCase()
  );
  return res.json({
    success: true,
    data: customerLoans
  });
};
