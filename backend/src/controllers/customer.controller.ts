import { Request, Response } from 'express';
import { customerService } from '../services/customer.service.js';
import { validatePhone, validateIDProof } from '../utils/kycValidation.js';

export const getCustomers = (req: Request, res: Response) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const customers = customerService.getAll(includeDeleted);
  return res.json({
    success: true,
    message: 'Customers retrieved successfully',
    data: customers,
    timestamp: new Date().toISOString()
  });
};

export const getCustomerById = (req: Request, res: Response) => {
  const customer = customerService.getById(req.params.id);
  if (!customer) {
    return res.status(404).json({
      success: false,
      message: `Customer ${req.params.id} not found`,
      error: { code: 'CUSTOMER_NOT_FOUND' }
    });
  }
  return res.json({
    success: true,
    message: 'Customer retrieved',
    data: customer
  });
};

export const searchCustomers = (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const includeDeleted = req.query.includeDeleted === 'true';
  const results = customerService.search(query, includeDeleted);
  return res.json({
    success: true,
    data: results
  });
};

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { name, phone, idProof, idNumber, currentAddress, currentAddressDetails } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer Full Name is required.',
        error: { code: 'INVALID_NAME' }
      });
    }

    const phoneVal = validatePhone(phone);
    if (!phoneVal.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneVal.error || 'Please enter a valid 10-digit Indian mobile number.',
        error: { code: 'INVALID_PHONE' }
      });
    }

    const idVal = validateIDProof(idProof || 'Aadhaar Card', idNumber);
    if (!idVal.isValid) {
      return res.status(400).json({
        success: false,
        message: idVal.error || 'Invalid ID Proof Number.',
        error: { code: 'INVALID_ID_PROOF' }
      });
    }

    const hasAddress = (currentAddress && currentAddress.trim()) || (currentAddressDetails && (currentAddressDetails.houseNumber || currentAddressDetails.street || currentAddressDetails.locality || currentAddressDetails.city));
    if (!hasAddress) {
      return res.status(400).json({
        success: false,
        message: 'Current Address is required.',
        error: { code: 'INVALID_ADDRESS' }
      });
    }

    const payload = {
      ...req.body,
      name: name.trim(),
      phone: phoneVal.normalizedValue || phone.trim(),
      idProof: idProof || 'Aadhaar Card',
      idNumber: idVal.formattedValue || idNumber.trim()
    };

    const newCustomer = await customerService.create(payload);
    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer
    });
  } catch (err: any) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message || 'This mobile number is already registered.',
        error: 'DUPLICATE_PHONE_NUMBER'
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { name, phone, idProof, idNumber, currentAddress } = req.body || {};

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Customer Full Name cannot be empty.',
        error: { code: 'INVALID_NAME' }
      });
    }

    if (phone !== undefined) {
      const phoneVal = validatePhone(phone);
      if (!phoneVal.isValid) {
        return res.status(400).json({
          success: false,
          message: phoneVal.error || 'Please enter a valid 10-digit Indian mobile number.',
          error: { code: 'INVALID_PHONE' }
        });
      }
    }

    if (idNumber !== undefined) {
      const idVal = validateIDProof(idProof || 'Aadhaar Card', idNumber);
      if (!idVal.isValid) {
        return res.status(400).json({
          success: false,
          message: idVal.error || 'Invalid ID Proof Number.',
          error: { code: 'INVALID_ID_PROOF' }
        });
      }
    }

    if (currentAddress !== undefined && (!currentAddress || !currentAddress.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Current Address cannot be empty.',
        error: { code: 'INVALID_ADDRESS' }
      });
    }

    const updated = await customerService.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    return res.json({
      success: true,
      message: 'Customer updated',
      data: updated
    });
  } catch (err: any) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message || 'This mobile number is already registered to another customer.',
        error: 'DUPLICATE_PHONE_NUMBER'
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  const userRole = (req.headers['user-role'] as string) || req.body?.userRole || 'OPERATOR';
  const result = await customerService.delete(req.params.id, userRole);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      message: result.message || 'Failed to delete customer'
    });
  }
  return res.json({
    success: true,
    message: 'Customer soft-deleted successfully'
  });
};

export const restoreCustomer = async (req: Request, res: Response) => {
  const userRole = (req.headers['user-role'] as string) || req.body?.userRole || 'OPERATOR';
  const result = await customerService.restore(req.params.id, userRole);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      message: result.message || 'Failed to restore customer'
    });
  }
  return res.json({
    success: true,
    message: 'Customer restored successfully'
  });
};

export const deletePermanentlyCustomer = async (req: Request, res: Response) => {
  const userRole = (req.headers['user-role'] as string) || req.body?.userRole || 'OPERATOR';
  const result = await customerService.deletePermanently(req.params.id, userRole);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      message: result.message || 'Failed to permanently delete customer'
    });
  }
  return res.json({
    success: true,
    message: result.message || 'Customer and all associated records permanently deleted successfully'
  });
};
