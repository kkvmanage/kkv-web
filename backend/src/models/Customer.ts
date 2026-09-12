import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomerPhoto {
  fileId: string;
  fileName?: string;
  url: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt?: Date;
  publicId?: string; // alias for legacy/backward compatibility
}

export interface IKYCDocument {
  documentType: string;
  documentNumber?: string;
  documentName?: string;
  fileId: string;
  fileName?: string;
  url: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt?: Date;
  publicId?: string; // alias for legacy/backward compatibility
  resourceType?: string;
}

export interface IStructuredAddress {
  houseNumber?: string;
  street?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface ICustomer extends Document {
  customerId: string;
  numericId?: number;
  fullName: string;
  name?: string; // alias/legacy compatibility
  gender: 'Male' | 'Female' | 'Other';
  phoneNumber: string;
  phone?: string; // alias/legacy compatibility
  phoneNormalized?: string;
  email?: string;
  occupation?: string;
  age?: number;
  dateOfBirth?: string;
  customerPhoto?: ICustomerPhoto;
  photoSource?: 'upload' | 'webcam' | null;
  
  // Address info
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  currentAddress?: string;
  permanentAddress?: string;
  currentAddressDetails?: IStructuredAddress;
  permanentAddressDetails?: IStructuredAddress;
  currentLocation?: any;
  permanentLocation?: any;

  // KYC Info
  idProofType?: string;
  idProof?: string; // alias/legacy compatibility
  idProofNumber?: string;
  idNumber?: string; // alias/legacy compatibility
  extraPan?: string;
  docName?: string;
  kycDocuments: IKYCDocument[];

  // Operational metadata
  status: 'VERIFIED' | 'PENDING' | 'BLOCKED';
  joinedDate?: string;
  activeLoansCount: number;
  totalBorrowed: number;
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerPhotoSchema = new Schema<ICustomerPhoto>(
  {
    fileId: { type: String, default: '' },
    fileName: { type: String, default: 'customer-photo.jpg' },
    url: { type: String, default: '' },
    mimeType: { type: String, default: 'image/jpeg' },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    publicId: { type: String, default: '' }
  },
  { _id: false }
);

const KYCDocumentSchema = new Schema<IKYCDocument>(
  {
    documentType: { type: String, required: true },
    documentNumber: { type: String, default: '' },
    documentName: { type: String, default: '' },
    fileId: { type: String, required: true },
    fileName: { type: String, default: '' },
    url: { type: String, required: true },
    mimeType: { type: String, default: 'image/jpeg' },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    publicId: { type: String, default: '' },
    resourceType: { type: String, default: 'image' }
  },
  { _id: true, timestamps: true }
);

const StructuredAddressSchema = new Schema<IStructuredAddress>(
  {
    houseNumber: { type: String, default: '' },

    street: { type: String, default: '' },
    locality: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' },
    pincode: { type: String, default: '' }
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    numericId: {
      type: Number,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      index: true
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: [true, 'Gender is required'],
      default: 'Male'
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true
    },
    phoneNormalized: {
      type: String,
      trim: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    occupation: {
      type: String,
      trim: true,
      default: 'Self Employed'
    },
    age: {
      type: Number,
      min: 0,
      max: 120
    },
    dateOfBirth: {
      type: String,
      trim: true
    },
    customerPhoto: {
      type: CustomerPhotoSchema,
      default: () => ({ url: '', publicId: '' })
    },
    photoSource: {
      type: String,
      enum: ['upload', 'webcam', null],
      default: null
    },

    // Address
    address: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    district: {
      type: String,
      trim: true,
      default: ''
    },
    state: {
      type: String,
      trim: true,
      default: 'Tamil Nadu'
    },
    pincode: {
      type: String,
      trim: true,
      default: ''
    },
    currentAddress: {
      type: String,
      trim: true,
      default: ''
    },
    permanentAddress: {
      type: String,
      trim: true,
      default: ''
    },
    currentAddressDetails: {
      type: StructuredAddressSchema,
      default: () => ({})
    },
    permanentAddressDetails: {
      type: StructuredAddressSchema,
      default: () => ({})
    },
    currentLocation: {
      type: Schema.Types.Mixed,
      default: null
    },
    permanentLocation: {
      type: Schema.Types.Mixed,
      default: null
    },

    // KYC info
    idProofType: {
      type: String,
      enum: ['Aadhaar', 'PAN', 'Aadhaar + PAN', 'Voter ID', 'Driving License', 'Driving Licence', 'Passport', 'Other'],
      default: 'Aadhaar'
    },
    idProofNumber: {
      type: String,
      trim: true,
      index: true,
      default: ''
    },
    extraPan: {
      type: String,
      trim: true,
      default: ''
    },
    docName: {
      type: String,
      trim: true,
      default: ''
    },
    kycDocuments: {
      type: [KYCDocumentSchema],
      default: []
    },

    // Status and financials
    status: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'BLOCKED'],
      default: 'VERIFIED'
    },
    joinedDate: {
      type: String,
      default: () => new Date().toLocaleDateString('en-GB')
    },
    activeLoansCount: {
      type: Number,
      default: 0
    },
    totalBorrowed: {
      type: Number,
      default: 0
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret: any) {
        // Alias legacy fields so frontend continues seamlessly
        ret.id = ret.customerId || ret._id;
        ret.name = ret.fullName;
        ret.phone = ret.phoneNumber;
        ret.idProof = ret.idProofType;
        ret.idNumber = ret.idProofNumber;
        if (ret.customerPhoto?.url) {
          ret.photoUrl = ret.customerPhoto.url;
        }
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for seamless compatibility
CustomerSchema.virtual('name').get(function (this: ICustomer) {
  return this.fullName;
});
CustomerSchema.virtual('name').set(function (this: ICustomer, val: string) {
  this.fullName = val;
});

CustomerSchema.virtual('phone').get(function (this: ICustomer) {
  return this.phoneNumber;
});
CustomerSchema.virtual('phone').set(function (this: ICustomer, val: string) {
  this.phoneNumber = val;
});

CustomerSchema.virtual('idProof').get(function (this: ICustomer) {
  return this.idProofType;
});
CustomerSchema.virtual('idProof').set(function (this: ICustomer, val: string) {
  this.idProofType = val;
});

CustomerSchema.virtual('idNumber').get(function (this: ICustomer) {
  return this.idProofNumber;
});
CustomerSchema.virtual('idNumber').set(function (this: ICustomer, val: string) {
  this.idProofNumber = val;
});

// Pre-validate hook for seamless alias normalization between formats
CustomerSchema.pre('validate', function (this: any, next?: any) {
  const doc = this;
  if (!doc.customerId && doc.id) {
    doc.customerId = doc.id;
  }
  if (!doc.fullName && doc.name) {
    doc.fullName = doc.name;
  }
  if (!doc.name && doc.fullName) {
    doc.name = doc.fullName;
  }
  if (!doc.phoneNumber && doc.phone) {
    doc.phoneNumber = doc.phone;
  }
  if (!doc.phone && doc.phoneNumber) {
    doc.phone = doc.phoneNumber;
  }
  if (!doc.phoneNormalized && (doc.phoneNumber || doc.phone)) {
    doc.phoneNormalized = String(doc.phoneNumber || doc.phone).replace(/\D/g, '').slice(-10);
  }
  if (!doc.idProofType && doc.idProof) {
    doc.idProofType = doc.idProof;
  }
  if (!doc.idProofNumber && doc.idNumber) {
    doc.idProofNumber = doc.idNumber;
  }
  if (!doc.customerPhoto) {
    doc.customerPhoto = { url: '', publicId: '' };
  } else if (typeof doc.customerPhoto === 'string') {
    doc.customerPhoto = { url: doc.customerPhoto, publicId: '' };
  }
  if (typeof next === 'function') {
    next();
  }
});

export const CustomerModel = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
export default CustomerModel;
