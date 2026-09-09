import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffAudit extends Document {
  staffId: string;
  staffUid?: string;
  staffEmail?: string;
  action: string;
  performedBy: string;
  actorEmail?: string;
  description: string;
  details?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const StaffAuditSchema = new Schema<IStaffAudit>(
  {
    staffId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    staffUid: {
      type: String,
      trim: true
    },
    staffEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    performedBy: {
      type: String,
      required: true,
      default: 'SYSTEM',
      trim: true
    },
    actorEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    details: {
      type: String,
      trim: true,
      default: ''
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret: any) {
        ret.id = ret._id?.toString();
        return ret;
      }
    }
  }
);

StaffAuditSchema.index({ timestamp: -1 });
StaffAuditSchema.index({ staffId: 1, timestamp: -1 });

export const StaffAuditModel =
  mongoose.models.StaffAudit || mongoose.model<IStaffAudit>('StaffAudit', StaffAuditSchema);

export default StaffAuditModel;
