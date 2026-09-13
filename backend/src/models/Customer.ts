import { CustomerLocation, NomineeDetails, GuarantorDetails } from '../types/index.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

export interface IAddressDetails {
  houseNo?: string;
  street?: string;
  landmark?: string;
  pincode: string;
  district: string;
  state: string;
  city?: string;
}

export interface ICustomerPhoto {
  url?: string;
  fileId?: string;
  fileName?: string;
  originalFileName?: string;
  size?: number;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  publicId?: string;
  resourceType?: string;
}

export interface IKYCDocument {
  docType?: string;
  docNumber?: string;
  documentType?: string;
  documentNumber?: string;
  documentName?: string;
  fileId?: string;
  fileName?: string;
  url?: string;
  mimeType?: string;
  fileSize?: number;
  publicId?: string;
  resourceType?: string;
  frontPhotoUrl?: string;
  backPhotoUrl?: string;
  verified?: boolean;
  uploadedAt?: string;
}

export interface ICustomer {
  id: string;
  customerId: string;
  customerNo?: string;
  name: string;
  fullName?: string;
  mobile: string;
  phoneNumber?: string;
  phone?: string;
  alternateNumber?: string;
  alternatePhone?: string;
  email?: string;
  dateOfBirth?: string;
  dob?: string;
  age?: number;
  gender: 'Male' | 'Female' | 'Other';
  occupation?: string;
  photoUrl?: string;
  photoBase64?: string;
  branchId?: string;
  complexId?: string;

  // Primary Address
  address: string;
  currentAddress?: string;
  permanentAddress?: string;
  isSameAddress?: boolean;
  sameAsCurrentAddress?: boolean;
  location?: CustomerLocation;
  currentAddressDetails?: IAddressDetails;
  permanentAddressDetails?: IAddressDetails;

  // Relations
  fatherHusbandName?: string;
  relationship?: 'Father' | 'Husband' | 'Guardian';
  nominee?: NomineeDetails;
  guarantor?: GuarantorDetails;

  // Legacy nominee fields
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  nomineeAadhaar?: string;
  nomineePan?: string;

  // Legacy guarantor fields
  guarantorName?: string;
  guarantorRelation?: string;
  guarantorPhone?: string;
  guarantorAadhaar?: string;
  guarantorPan?: string;

  // KYC
  idProofType?: string;
  idProof?: string;
  idProofNumber?: string;
  idNumber?: string;
  extraPan?: string;
  docName?: string;
  kycDocuments?: IKYCDocument[];

  // Metadata
  status: 'VERIFIED' | 'PENDING' | 'BLOCKED';
  joinedDate?: string;
  activeLoansCount: number;
  totalBorrowed: number;
  isDeleted: boolean;
  deletedAt?: Date | string | null;
  deletedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class CustomerModel {
  public static find(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    let records = telegramRepository.getRecords<ICustomer>('CUSTOMER', { includeDeleted });

    if (query.customerId) {
      records = records.filter((c) => c.customerId === query.customerId);
    }
    if (query.phoneNumber || query.phone) {
      const p = query.phoneNumber || query.phone;
      records = records.filter((c) => c.phoneNumber === p || c.phone === p);
    }

    const chain = {
      sort: () => chain,
      select: () => chain,
      lean: async () => records,
      then: (resolve: any, reject?: any) => Promise.resolve(records).then(resolve, reject)
    };
    return chain;
  }

  public static findOne(query: any = {}): any {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    const records = telegramRepository.getRecords<ICustomer>('CUSTOMER', { includeDeleted });

    let match: ICustomer | null = null;
    if (query.customerId) {
      match = records.find((c) => c.customerId === query.customerId || c.id === query.customerId) || null;
    } else if (query.id) {
      match = records.find((c) => c.id === query.id || c.customerId === query.id) || null;
    } else if (query.phoneNumber || query.phone) {
      const p = query.phoneNumber || query.phone;
      match = records.find((c) => c.phoneNumber === p || c.phone === p) || null;
    } else if (query.$or && Array.isArray(query.$or)) {
      match = records.find((c) =>
        query.$or.some((clause: any) =>
          (clause.customerId && (c.customerId === clause.customerId || c.id === clause.customerId)) ||
          (clause.id && (c.id === clause.id || c.customerId === clause.id)) ||
          (clause.phoneNumber && (c.phoneNumber === clause.phoneNumber || c.phone === clause.phoneNumber))
        )
      ) || null;
    }

    const chain = {
      select: () => chain,
      lean: async () => match,
      then: (resolve: any, reject?: any) => Promise.resolve(match).then(resolve, reject)
    };
    return chain;
  }

  public static async create(doc: any): Promise<any> {
    const id = doc.customerId || doc.id || `KKV-${Date.now()}`;
    const res = await telegramRepository.createRecord('CUSTOMER', id, { ...doc, id, customerId: id });
    return res.data;
  }

  public static async deleteOne(query: any): Promise<any> {
    const id = query.customerId || query.id;
    if (id) {
      await telegramRepository.deleteRecord('CUSTOMER', id);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  public static async findOneAndUpdate(query: any, update: any, _options: any = {}): Promise<any> {
    const doc = update.$set || update;
    const id = doc.customerId || doc.id || (query.customerId || query.id);
    if (!id) return null;

    const existing = telegramRepository.getRecordById<ICustomer>('CUSTOMER', id, true);
    if (existing) {
      const updated = await telegramRepository.updateRecord<ICustomer>('CUSTOMER', id, doc);
      return updated.data;
    } else {
      const created = await telegramRepository.createRecord<ICustomer>('CUSTOMER', id, doc);
      return created.data;
    }
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const includeDeleted = query.isDeleted ? query.isDeleted.$ne !== true : false;
    return telegramRepository.countRecords('CUSTOMER', undefined, includeDeleted);
  }

  public static async deleteMany(query: any = {}): Promise<{ deletedCount: number }> {
    const { cleared } = await telegramRepository.resetApplicationData(['CUSTOMER']);
    return { deletedCount: cleared };
  }

  public static async updateOne(query: any, update: any): Promise<any> {
    const id = query.customerId || query.id || (query.$or && query.$or[0]?.customerId);
    if (!id) return { modifiedCount: 0 };
    const doc = update.$set || update;
    await telegramRepository.updateRecord('CUSTOMER', id, doc);
    return { modifiedCount: 1 };
  }

  public static async insertMany(docs: any[]): Promise<any[]> {
    const results = [];
    for (const d of docs) {
      const id = d.customerId || d.id;
      const res = await telegramRepository.createRecord('CUSTOMER', id, d);
      results.push(res.data);
    }
    return results;
  }
}

export default CustomerModel;
