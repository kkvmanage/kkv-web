import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  errors?: any;
}

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Middleware]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Handle Validation Error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed on submitted data',
      errors: err.errors || err.message
    });
  }

  // Handle Duplicate Key / Conflict Error
  if (err.code === 'DUPLICATE_RECORD' || (err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0] || 'identifier';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
      error: 'DUPLICATE_RECORD'
    });
  }

  // Handle Concurrency Conflict Error
  if (err.code === 'CONCURRENCY_CONFLICT') {
    return res.status(409).json({
      success: false,
      message: err.message || 'Record has been modified by another workstation. Please refresh.',
      error: 'CONCURRENCY_CONFLICT'
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: err.code || 'SERVER_ERROR'
    }
  });
};
