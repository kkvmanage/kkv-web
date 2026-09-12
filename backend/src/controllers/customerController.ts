import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CustomerModel, ICustomer, IKYCDocument, ICustomerPhoto } from '../models/Customer.js';
import { FileAttachmentModel } from '../models/FileAttachment.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { generateCustomerId } from '../utils/customerIdGenerator.js';
import { ensureMongoConnected, isMongoConnected } from '../config/database.js';

export interface CreateCustomerRequest {
  fullName: string;
  gender: 'Male' | 'Female' | 'Other';
  phoneNumber: string;
  email?: string;
  occupation?: string;
  age?: number;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  currentAddress?: string;
  permanentAddress?: string;
  idProofType?: string;
  idProofNumber?: string;
  extraPan?: string;
  docName?: string;
  customerPhoto?: string;
  status?: 'VERIFIED' | 'PENDING' | 'BLOCKED';
}

/**
 * Validates Indian 10-digit mobile number
 */
function isValidIndianPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
}

/**
 * Normalizes phone number to 10 digits
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Automatically calculates age from date of birth (YYYY-MM-DD or DD/MM/YYYY)
 */
function calculateAge(dobStr: string): number | undefined {
  if (!dobStr) return undefined;
  try {
    let birthDate: Date;
    if (dobStr.includes('/')) {
      const [d, m, y] = dobStr.split('/').map(Number);
      birthDate = new Date(y, m - 1, d);
    } else {
      birthDate = new Date(dobStr);
    }
    if (isNaN(birthDate.getTime())) return undefined;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Helper to convert a base64 data URI to a Buffer
 */
function dataUriToBuffer(dataUri: string): { buffer: Buffer; mimeType: string } | null {
  try {
    const match = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!match) return null;
    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], 'base64')
    };
  } catch {
    return null;
  }
}

/**
 * Helper to upload a buffer to Google Drive and persist FileAttachment metadata
 */
async function uploadAndRecordCustomerFile(options: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  customerId: string;
  documentType: string;
  uploadedBy?: string;
}): Promise<{ fileId: string; driveFileId: string; url: string; fileName: string; fileSize: number }> {
  const { buffer, mimeType, originalName, customerId, documentType, uploadedBy } = options;
  const uniqueSuffix = uuidv4().substring(0, 8);
  const ext = originalName.includes('.') ? path.extname(originalName).toLowerCase() : (mimeType === 'application/pdf' ? '.pdf' : '.jpg');
  const storedFileName = `${customerId}_${documentType}_${uniqueSuffix}${ext}`;
  const fileId = `FILE_${Date.now()}_${uniqueSuffix}`;

  let driveFileId = '';
  let driveUrl = '';
  let webViewLink = '';
  let webContentLink = '';

  if (googleDriveService.isReady()) {
    try {
      const targetFolderId = await googleDriveService.resolveEntityFolder({
        entityType: 'customer',
        entityId: customerId,
        documentType
      });
      const driveRes = await googleDriveService.uploadBuffer(buffer, storedFileName, mimeType, targetFolderId);
      driveFileId = driveRes.fileId;
      driveUrl = driveRes.webViewLink || `https://drive.google.com/file/d/${driveRes.fileId}/view`;
      webViewLink = driveRes.webViewLink || '';
      webContentLink = driveRes.webContentLink || '';
    } catch (err: any) {
      console.warn(`[CustomerController] Google Drive upload notice for ${documentType}:`, err?.message || err);
      driveFileId = `local_${fileId}`;
    }
  } else {
    driveFileId = `local_${fileId}`;
  }

  // Persist FileAttachment record in MongoDB
  try {
    await FileAttachmentModel.create({
      fileId,
      entityType: 'customer',
      entityId: customerId,
      documentType,
      originalFileName: originalName,
      storedFileName,
      mimeType,
      fileSize: buffer.length,
      driveFileId,
      driveUrl,
      webViewLink,
      webContentLink,
      uploadedBy: uploadedBy || 'STAFF',
      isDeleted: false
    });
  } catch (dbErr: any) {
    console.warn(`[CustomerController] FileAttachment metadata creation notice:`, dbErr?.message || dbErr);
  }

  return {
    fileId,
    driveFileId,
    url: `/api/files/${fileId}/view`,
    fileName: storedFileName,
    fileSize: buffer.length
  };
}

/**
 * POST /api/customers
 * Permanent MongoDB creation with Google Drive attachments.
 */
export const createCustomer = async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      await ensureMongoConnected();
      if (!isMongoConnected()) {
        return res.status(503).json({
          success: false,
          message: 'Database is currently unavailable. Permanent MongoDB connection is required.',
          error: { code: 'DATABASE_DISCONNECTED' }
        });
      }
    }

    const body = req.body || {};
    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
    const uploadedBy = (req as any).user?.email || (req as any).user?.id || 'STAFF';

    // Extract and normalize fields
    const fullName = (body.fullName || body.name || '').trim();
    const rawPhoneNumber = (body.phoneNumber || body.phone || '').trim();
    const gender = body.gender || 'Male';
    const email = (body.email || '').trim().toLowerCase();
    const occupation = (body.occupation || 'Self Employed').trim();
    const dateOfBirth = (body.dateOfBirth || body.dob || '').trim();
    let age = body.age ? parseInt(body.age, 10) : undefined;

    if (dateOfBirth && !age) {
      age = calculateAge(dateOfBirth);
    }

    const address = (body.address || body.currentAddress || '').trim();
    const city = (body.city || '').trim();
    const district = (body.district || '').trim();
    const state = (body.state || 'Tamil Nadu').trim();
    const pincode = (body.pincode || '').trim();
    const currentAddress = (body.currentAddress || address).trim();
    const permanentAddress = (body.permanentAddress || currentAddress).trim();

    const idProofType = body.idProofType || body.idProof || 'Aadhaar';
    const idProofNumber = (body.idProofNumber || body.idNumber || '').trim();
    const extraPan = (body.extraPan || '').trim();
    const docName = (body.docName || '').trim();

    if (!fullName) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }

    if (!rawPhoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone Number is required.' });
    }

    const phoneNumber = normalizePhone(rawPhoneNumber);
    if (!isValidIndianPhone(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).'
      });
    }

    // Check duplicate phone number in MongoDB
    const existingInDb = await CustomerModel.findOne({
      isDeleted: { $ne: true },
      $or: [{ phoneNumber }, { phoneNormalized: phoneNumber }]
    });

    if (existingInDb) {
      return res.status(409).json({
        success: false,
        message: `This mobile number is already registered to ${existingInDb.fullName} (${existingInDb.customerId}).`,
        error: 'DUPLICATE_PHONE_NUMBER'
      });
    }

    // Generate unique sequential Customer ID
    const { customerId, sequenceNumber } = await generateCustomerId('KKV-2026');

    // Customer Photo Upload (Google Drive)
    let customerPhotoData: ICustomerPhoto = {
      fileId: '',
      fileName: 'customer-photo.jpg',
      url: '',
      mimeType: 'image/jpeg',
      fileSize: 0,
      uploadedAt: new Date(),
      publicId: ''
    };

    const photoFile = files['customerPhoto']?.[0];
    if (photoFile) {
      const uploaded = await uploadAndRecordCustomerFile({
        buffer: photoFile.buffer,
        mimeType: photoFile.mimetype || 'image/jpeg',
        originalName: photoFile.originalname || `customer-photo-${customerId}.jpg`,
        customerId,
        documentType: 'customer_photo',
        uploadedBy
      });
      customerPhotoData = {
        fileId: uploaded.fileId,
        fileName: uploaded.fileName,
        url: uploaded.url,
        mimeType: photoFile.mimetype || 'image/jpeg',
        fileSize: uploaded.fileSize,
        uploadedAt: new Date(),
        publicId: uploaded.driveFileId
      };
    } else if (body.customerPhoto && typeof body.customerPhoto === 'string') {
      const parsed = dataUriToBuffer(body.customerPhoto);
      if (parsed) {
        const uploaded = await uploadAndRecordCustomerFile({
          buffer: parsed.buffer,
          mimeType: parsed.mimeType,
          originalName: `customer-photo-${customerId}.jpg`,
          customerId,
          documentType: 'customer_photo',
          uploadedBy
        });
        customerPhotoData = {
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          url: uploaded.url,
          mimeType: parsed.mimeType,
          fileSize: uploaded.fileSize,
          uploadedAt: new Date(),
          publicId: uploaded.driveFileId
        };
      } else {
        customerPhotoData = {
          fileId: `photo_${customerId}_${Date.now()}`,
          fileName: `customer-photo-${customerId}.jpg`,
          url: body.customerPhoto,
          mimeType: 'image/jpeg',
          fileSize: 0,
          uploadedAt: new Date(),
          publicId: `photo_${customerId}_${Date.now()}`
        };
      }
    }

    // KYC Documents (Google Drive)
    const kycDocuments: IKYCDocument[] = [];
    const kycFiles = [
      ...(files['kycDocuments'] || []),
      ...(files['aadhaarDoc'] || []),
      ...(files['panDoc'] || []),
      ...(files['otherDoc'] || [])
    ];

    for (let i = 0; i < kycFiles.length; i++) {
      const file = kycFiles[i];
      const docType =
        file.fieldname === 'aadhaarDoc' ? 'Aadhaar' :
        file.fieldname === 'panDoc' ? 'PAN' :
        file.fieldname === 'otherDoc' ? (docName || 'Other') : idProofType;

      const isPdf = file.mimetype === 'application/pdf';
      const resourceType = isPdf ? 'raw' : 'image';

      const uploaded = await uploadAndRecordCustomerFile({
        buffer: file.buffer,
        mimeType: file.mimetype || (isPdf ? 'application/pdf' : 'image/jpeg'),
        originalName: file.originalname || `${docType.toLowerCase()}_${i + 1}${isPdf ? '.pdf' : '.jpg'}`,
        customerId,
        documentType: docType.toLowerCase(),
        uploadedBy
      });

      kycDocuments.push({
        documentType: docType,
        documentNumber: idProofNumber || '',
        documentName: file.originalname || `${docType} Document`,
        fileId: uploaded.fileId,
        fileName: uploaded.fileName,
        url: uploaded.url,
        mimeType: file.mimetype || (isPdf ? 'application/pdf' : 'image/jpeg'),
        fileSize: uploaded.fileSize,
        uploadedAt: new Date(),
        publicId: uploaded.driveFileId,
        resourceType
      });
    }

    const customerPayload = {
      customerId,
      numericId: sequenceNumber,
      fullName,
      name: fullName,
      gender,
      phoneNumber,
      phone: phoneNumber,
      phoneNormalized: phoneNumber,
      email,
      occupation,
      age: age || 30,
      dateOfBirth,
      customerPhoto: customerPhotoData,
      photoSource: body.photoSource || (photoFile ? 'upload' : null),
      address,
      city,
      district,
      state,
      pincode,
      currentAddress,
      permanentAddress,
      currentAddressDetails: {
        houseNumber: body.currentAddressDetails?.houseNumber || '',
        street: body.currentAddressDetails?.street || address,
        locality: body.currentAddressDetails?.locality || '',
        city: city || body.currentAddressDetails?.city || '',
        district: district || body.currentAddressDetails?.district || '',
        state: state || 'Tamil Nadu',
        country: 'India',
        pincode: pincode || body.currentAddressDetails?.pincode || ''
      },
      permanentAddressDetails: {
        houseNumber: body.permanentAddressDetails?.houseNumber || '',
        street: body.permanentAddressDetails?.street || permanentAddress,
        locality: body.permanentAddressDetails?.locality || '',
        city: city || body.permanentAddressDetails?.city || '',
        district: district || body.permanentAddressDetails?.district || '',
        state: state || 'Tamil Nadu',
        country: 'India',
        pincode: pincode || body.permanentAddressDetails?.pincode || ''
      },
      currentLocation: body.currentLocation ? (typeof body.currentLocation === 'string' ? JSON.parse(body.currentLocation) : body.currentLocation) : null,
      permanentLocation: body.permanentLocation ? (typeof body.permanentLocation === 'string' ? JSON.parse(body.permanentLocation) : body.permanentLocation) : null,
      idProofType,
      idProof: idProofType,
      idProofNumber,
      idNumber: idProofNumber,
      extraPan,
      docName,
      kycDocuments,
      status: body.status || 'VERIFIED',
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      activeLoansCount: 0,
      totalBorrowed: 0,
      isDeleted: false
    };

    const savedCustomer = await CustomerModel.create(customerPayload);

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully and saved permanently in MongoDB.',
      data: savedCustomer
    });
  } catch (error: any) {
    console.error('[CustomerController] createCustomer unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred while creating customer.'
    });
  }
};

/**
 * GET /api/customers
 */
export const getCustomers = async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      await ensureMongoConnected();
      if (!isMongoConnected()) {
        return res.status(503).json({
          success: false,
          message: 'MongoDB is disconnected.',
          error: { code: 'DATABASE_DISCONNECTED' }
        });
      }
    }

    const includeDeleted = req.query.includeDeleted === 'true';
    const filter = includeDeleted ? {} : { isDeleted: { $ne: true } };

    const customers = await CustomerModel.find(filter).sort({ createdAt: -1 }).lean();

    const mapped = customers.map((c: any) => ({
      ...c,
      id: c.customerId || c._id?.toString(),
      name: c.fullName,
      phone: c.phoneNumber,
      idProof: c.idProofType,
      idNumber: c.idProofNumber,
      customerPhoto: c.customerPhoto?.url || null,
      customerPhotoData: c.customerPhoto
    }));

    return res.json({
      success: true,
      message: 'Customers retrieved successfully from MongoDB.',
      data: mapped,
      count: mapped.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[CustomerController] getCustomers error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve customers from MongoDB.'
    });
  }
};

/**
 * GET /api/customers/:id
 */
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      await ensureMongoConnected();
      if (!isMongoConnected()) {
        return res.status(503).json({
          success: false,
          message: 'MongoDB is disconnected.',
          error: { code: 'DATABASE_DISCONNECTED' }
        });
      }
    }

    const targetId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(targetId);

    const customer = await CustomerModel.findOne({
      $or: [
        { customerId: targetId },
        ...(isObjectId ? [{ _id: targetId }] : [])
      ]
    }).lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID "${targetId}" not found in MongoDB.`,
        error: { code: 'CUSTOMER_NOT_FOUND' }
      });
    }

    return res.json({
      success: true,
      message: 'Customer retrieved successfully.',
      data: {
        ...customer,
        id: customer.customerId || customer._id?.toString(),
        name: customer.fullName,
        phone: customer.phoneNumber,
        idProof: customer.idProofType,
        idNumber: customer.idProofNumber,
        customerPhoto: customer.customerPhoto?.url || null,
        customerPhotoData: customer.customerPhoto
      }
    });
  } catch (error: any) {
    console.error('[CustomerController] getCustomerById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve customer.'
    });
  }
};

/**
 * GET /api/customers/search
 */
export const searchCustomers = async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      await ensureMongoConnected();
      if (!isMongoConnected()) {
        return res.status(503).json({
          success: false,
          message: 'MongoDB is disconnected.',
          error: { code: 'DATABASE_DISCONNECTED' }
        });
      }
    }

    const query = ((req.query.query || req.query.q) as string || '').trim();
    if (!query) {
      return getCustomers(req, res);
    }

    const normPhone = normalizePhone(query);
    const regex = new RegExp(query, 'i');

    const results = await CustomerModel.find({
      isDeleted: { $ne: true },
      $or: [
        { fullName: regex },
        { customerId: regex },
        { phoneNumber: regex },
        ...(normPhone ? [{ phoneNormalized: new RegExp(normPhone) }] : []),
        { idProofNumber: regex },
        { address: regex }
      ]
    }).lean();

    const mapped = results.map((c: any) => ({
      ...c,
      id: c.customerId || c._id?.toString(),
      name: c.fullName,
      phone: c.phoneNumber,
      idProof: c.idProofType,
      idNumber: c.idProofNumber,
      customerPhoto: c.customerPhoto?.url || null,
      customerPhotoData: c.customerPhoto
    }));

    return res.json({
      success: true,
      data: mapped,
      count: mapped.length
    });
  } catch (error: any) {
    console.error('[CustomerController] searchCustomers error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Customer search failed.'
    });
  }
};

/**
 * PUT /api/customers/:id
 */
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      await ensureMongoConnected();
      if (!isMongoConnected()) {
        return res.status(503).json({
          success: false,
          message: 'MongoDB is disconnected.',
          error: { code: 'DATABASE_DISCONNECTED' }
        });
      }
    }

    const targetId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(targetId);
    const body = req.body || {};
    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};

    const existing = await CustomerModel.findOne({
      $or: [
        { customerId: targetId },
        ...(isObjectId ? [{ _id: targetId }] : [])
      ]
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID "${targetId}" not found.`,
        error: { code: 'CUSTOMER_NOT_FOUND' }
      });
    }

    const updateFields: any = { ...body, updatedAt: new Date() };

    // Normalize field names
    if (body.fullName || body.name) {
      updateFields.fullName = (body.fullName || body.name).trim();
      updateFields.name = updateFields.fullName;
    }
    if (body.phoneNumber || body.phone) {
      const rawPhone = (body.phoneNumber || body.phone).trim();
      const norm = normalizePhone(rawPhone);
      if (!isValidIndianPhone(norm)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid 10-digit Indian mobile number.'
        });
      }
      updateFields.phoneNumber = norm;
      updateFields.phone = norm;
      updateFields.phoneNormalized = norm;
    }
    if (body.idProofType || body.idProof) {
      updateFields.idProofType = body.idProofType || body.idProof;
      updateFields.idProof = updateFields.idProofType;
    }
    if (body.idProofNumber || body.idNumber) {
      updateFields.idProofNumber = (body.idProofNumber || body.idNumber).trim();
      updateFields.idNumber = updateFields.idProofNumber;
    }

    if (typeof updateFields.currentAddressDetails === 'string') {
      try { updateFields.currentAddressDetails = JSON.parse(updateFields.currentAddressDetails); } catch {}
    }
    if (typeof updateFields.permanentAddressDetails === 'string') {
      try { updateFields.permanentAddressDetails = JSON.parse(updateFields.permanentAddressDetails); } catch {}
    }
    if (typeof updateFields.currentLocation === 'string') {
      try { updateFields.currentLocation = JSON.parse(updateFields.currentLocation); } catch {}
    }
    if (typeof updateFields.permanentLocation === 'string') {
      try { updateFields.permanentLocation = JSON.parse(updateFields.permanentLocation); } catch {}
    }

    // Photo update (Google Drive)
    const uploadedBy = (req as any).user?.email || (req as any).user?.id || 'STAFF';
    const photoFile = files['customerPhoto']?.[0];
    if (photoFile) {
      const custId = existing.customerId;
      const uploaded = await uploadAndRecordCustomerFile({
        buffer: photoFile.buffer,
        mimeType: photoFile.mimetype || 'image/jpeg',
        originalName: photoFile.originalname || `customer-photo-${custId}-${Date.now()}.jpg`,
        customerId: custId,
        documentType: 'customer_photo',
        uploadedBy
      });
      updateFields.customerPhoto = {
        fileId: uploaded.fileId,
        fileName: uploaded.fileName,
        url: uploaded.url,
        mimeType: photoFile.mimetype || 'image/jpeg',
        fileSize: uploaded.fileSize,
        uploadedAt: new Date(),
        publicId: uploaded.driveFileId
      };
    } else if (body.customerPhoto && typeof body.customerPhoto === 'string' && body.customerPhoto.startsWith('data:image')) {
      const custId = existing.customerId;
      const parsed = dataUriToBuffer(body.customerPhoto);
      if (parsed) {
        const uploaded = await uploadAndRecordCustomerFile({
          buffer: parsed.buffer,
          mimeType: parsed.mimeType,
          originalName: `customer-photo-${custId}-${Date.now()}.jpg`,
          customerId: custId,
          documentType: 'customer_photo',
          uploadedBy
        });
        updateFields.customerPhoto = {
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          url: uploaded.url,
          mimeType: parsed.mimeType,
          fileSize: uploaded.fileSize,
          uploadedAt: new Date(),
          publicId: uploaded.driveFileId
        };
      }
    } else if (body.customerPhotoUrl && typeof body.customerPhotoUrl === 'string') {
      const custId = existing.customerId;
      updateFields.customerPhoto = {
        fileId: existing.customerPhoto?.fileId || `photo_${custId}_${Date.now()}`,
        fileName: existing.customerPhoto?.fileName || `customer-photo-${custId}.jpg`,
        url: body.customerPhotoUrl,
        mimeType: existing.customerPhoto?.mimeType || 'image/jpeg',
        fileSize: existing.customerPhoto?.fileSize || 0,
        uploadedAt: existing.customerPhoto?.uploadedAt || new Date(),
        publicId: existing.customerPhoto?.publicId || `photo_${custId}_${Date.now()}`
      };
    } else if (body.customerPhoto === 'null' || body.removePhoto === 'true') {
      updateFields.customerPhoto = null;
    }

    // KYC update (Google Drive)
    const kycFiles = [
      ...(files['kycDocuments'] || []),
      ...(files['aadhaarDoc'] || []),
      ...(files['panDoc'] || []),
      ...(files['otherDoc'] || [])
    ];

    if (kycFiles.length > 0) {
      const newKycDocs: IKYCDocument[] = [];
      const custId = existing.customerId;

      for (let i = 0; i < kycFiles.length; i++) {
        const file = kycFiles[i];
        const docType = updateFields.idProofType || existing.idProofType || 'KYC';
        const isPdf = file.mimetype === 'application/pdf';
        const resourceType = isPdf ? 'raw' : 'image';

        const uploaded = await uploadAndRecordCustomerFile({
          buffer: file.buffer,
          mimeType: file.mimetype || (isPdf ? 'application/pdf' : 'image/jpeg'),
          originalName: file.originalname || `${docType.toLowerCase()}_${i + 1}${isPdf ? '.pdf' : '.jpg'}`,
          customerId: custId,
          documentType: docType.toLowerCase(),
          uploadedBy
        });

        newKycDocs.push({
          documentType: docType,
          documentNumber: updateFields.idProofNumber || existing.idProofNumber || '',
          documentName: file.originalname,
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          url: uploaded.url,
          mimeType: file.mimetype || (isPdf ? 'application/pdf' : 'image/jpeg'),
          fileSize: uploaded.fileSize,
          uploadedAt: new Date(),
          publicId: uploaded.driveFileId,
          resourceType
        });
      }

      existing.kycDocuments.push(...newKycDocs);
    }

    Object.assign(existing, updateFields);
    const updatedDoc = await existing.save();

    return res.json({
      success: true,
      message: 'Customer updated successfully in MongoDB.',
      data: updatedDoc
    });
  } catch (error: any) {
    console.error('[CustomerController] updateCustomer error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update customer.'
    });
  }
};

/**
 * DELETE /api/customers/:id
 */
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      await ensureMongoConnected();
      if (!isMongoConnected()) {
        return res.status(503).json({
          success: false,
          message: 'MongoDB is disconnected.',
          error: { code: 'DATABASE_DISCONNECTED' }
        });
      }
    }

    const targetId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(targetId);

    const customer = await CustomerModel.findOne({
      $or: [
        { customerId: targetId },
        ...(isObjectId ? [{ _id: targetId }] : [])
      ]
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID "${targetId}" not found.`,
        error: { code: 'CUSTOMER_NOT_FOUND' }
      });
    }

    // Soft delete
    customer.isDeleted = true;
    customer.deletedAt = new Date();
    customer.deletedBy = (req as any).user?.email || (req as any).user?.id || 'ADMIN';
    await customer.save();

    return res.json({
      success: true,
      message: 'Customer moved to trash successfully.'
    });
  } catch (error: any) {
    console.error('[CustomerController] deleteCustomer error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete customer.'
    });
  }
};

export const restoreCustomer = async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(targetId);

    const customer = await CustomerModel.findOneAndUpdate(
      {
        $or: [
          { customerId: targetId },
          ...(isObjectId ? [{ _id: targetId }] : [])
        ]
      },
      { isDeleted: false, deletedAt: null, deletedBy: null },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID "${targetId}" not found.`,
        error: { code: 'CUSTOMER_NOT_FOUND' }
      });
    }

    return res.json({
      success: true,
      message: 'Customer restored successfully.',
      data: customer
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to restore customer.'
    });
  }
};

export const deletePermanentlyCustomer = async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(targetId);

    const result = await CustomerModel.deleteOne({
      $or: [
        { customerId: targetId },
        ...(isObjectId ? [{ _id: targetId }] : [])
      ]
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID "${targetId}" not found.`,
        error: { code: 'CUSTOMER_NOT_FOUND' }
      });
    }

    return res.json({
      success: true,
      message: 'Customer permanently deleted from database.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to permanently delete customer.'
    });
  }
};
