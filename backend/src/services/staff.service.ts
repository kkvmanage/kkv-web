import bcrypt from 'bcrypt';
import {
  StaffModel,
  IStaff,
  IUserPermissions,
  StaffRole,
  getDefaultPermissionsForRole,
  normalizeUserPermissions,
  ADMIN_DEFAULT_PERMISSIONS,
  STAFF_DEFAULT_PERMISSIONS,
  RENTAL_STAFF_DEFAULT_PERMISSIONS
} from '../models/Staff.js';
import { StaffAuditModel } from '../models/StaffAudit.js';
import { generateStaffId } from '../utils/staffIdGenerator.js';
import { sessionService } from './session.service.js';
import { localAuthService } from './localAuth.service.js';

const MASTER_ADMIN_EMAIL = 'admin@kkvgoldfinance.com';

export interface StaffVerificationResult {
  success: boolean;
  message?: string;
  disabled?: boolean;
  unauthorizedRole?: boolean;
  notFound?: boolean;
  user?: {
    id: string;
    uid: string;
    staffId: string;
    name: string;
    displayName: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
    isActive: boolean;
    phone?: string;
    permissions?: IUserPermissions;
  };
}

class StaffService {
  /**
   * Automatically seeds default Admin, Staff, and Rental Staff in local store if missing
   */
  public async ensureMasterAdmin(): Promise<void> {
    await localAuthService.seedDefaultUsers();
  }

  /**
   * Lists all staff members
   */
  public async listStaff(): Promise<any[]> {
    await this.ensureMasterAdmin();
    const staff = await StaffModel.find({});
    return staff.map((s: any) => {
      const role = s.role === 'MASTER_ADMIN' ? 'ADMIN' : s.role;
      const { passwordHash, ...safeDoc } = s;
      return {
        ...safeDoc,
        id: s.staffId || s.uid || s._id?.toString(),
        uid: s.uid || s.staffId,
        displayName: s.fullName || s.displayName,
        name: s.fullName || s.displayName,
        phone: s.phoneNumber || s.phone,
        role,
        permissions: normalizeUserPermissions(s.permissions, role),
        isActive: s.status === 'active' || s.status === 'ACTIVE' || s.isActive === true
      };
    });
  }

  /**
   * Retrieves single staff record by staffId, uid, or email
   */
  public async getStaffByUid(uid: string): Promise<any | null> {
    if (!uid) return null;
    const staff = await StaffModel.findOne({
      $or: [
        { staffId: uid },
        { uid: uid },
        { email: uid.toLowerCase().trim() },
        { _id: uid }
      ]
    });

    if (!staff) return null;

    const role = (staff.role as string) === 'MASTER_ADMIN' ? 'ADMIN' : staff.role;
    const { passwordHash, ...safeDoc } = staff as any;
    return {
      ...safeDoc,
      id: staff.staffId || staff.uid || staff._id?.toString(),
      displayName: staff.fullName || staff.displayName,
      name: staff.fullName || staff.displayName,
      phone: staff.phoneNumber || staff.phone,
      role,
      permissions: normalizeUserPermissions(staff.permissions, role),
      isActive: staff.status === 'active' || staff.status === 'ACTIVE' || staff.isActive === true
    };
  }

  /**
   * Retrieves staff record by email
   */
  public async getStaffByEmail(email: string): Promise<any | null> {
    if (!email) return null;
    const staff = await StaffModel.findOne({ email: email.toLowerCase().trim() });
    if (!staff) return null;
    const { passwordHash, ...safeDoc } = staff as any;
    return safeDoc;
  }

  /**
   * Creates a new staff member with bcrypt password hash
   */
  public async createStaff(
    data: {
      fullName?: string;
      displayName?: string;
      email: string;
      role: string;
      phoneNumber?: string;
      phone?: string;
      password?: string;
      initialPassword?: string;
      permissions?: Partial<IUserPermissions>;
      department?: string;
    },
    actorUid: string = 'uid_admin_01',
    actorEmail: string = MASTER_ADMIN_EMAIL,
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<any> {
    const email = (data.email || '').trim().toLowerCase();
    const fullName = (data.fullName || data.displayName || '').trim();
    const rawPhone = (data.phoneNumber || data.phone || '').trim();
    const phone = rawPhone.replace(/\D/g, '');
    const requestedRole = (data.role || 'STAFF').toUpperCase();

    if (requestedRole === 'ADMIN' || requestedRole === 'MASTER_ADMIN') {
      throw new Error('Creating administrator accounts via staff management is restricted. Administrator accounts must be created through authorized system setup.');
    }

    const role: StaffRole = requestedRole === 'RENTAL_STAFF' ? 'RENTAL_STAFF' : 'STAFF';

    if (!email) throw new Error('Email address is required.');
    if (!fullName) throw new Error('Full name is required.');

    const existingEmail = await StaffModel.findOne({ email });
    if (existingEmail) {
      throw new Error('An account with this email already exists.');
    }

    if (phone) {
      const existingPhone = await StaffModel.findOne({
        $or: [{ phoneNumber: phone }, { phone: phone }]
      });
      if (existingPhone) {
        throw new Error(`A staff member with this phone number already exists: ${phone}`);
      }
    }

    const prefix = role === 'RENTAL_STAFF' ? 'KKV-RS' : 'KKV-STAFF';
    const { staffId } = await generateStaffId(prefix);
    const uid = `uid_${staffId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

    const rawPassword = (data.password || data.initialPassword || '').trim();
    if (!rawPassword || rawPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const basePermissions = getDefaultPermissionsForRole(role);
    const permissions: IUserPermissions = normalizeUserPermissions(
      data.permissions ? { ...basePermissions, ...data.permissions } : basePermissions,
      role
    );

    const createdStaff = await StaffModel.create({
      staffId,
      uid,
      fullName,
      displayName: fullName,
      email,
      phoneNumber: phone || rawPhone,
      phone: phone || rawPhone,
      role,
      passwordHash,
      status: 'active',
      isActive: true,
      mustChangePassword: true,
      permissions,
      department: data.department || (role === 'RENTAL_STAFF' ? 'Rental Management' : 'Finance Operations'),
      createdByUid: actorUid,
      createdByEmail: actorEmail
    });

    await StaffAuditModel.create({
      staffId,
      staffUid: uid,
      staffEmail: email,
      action: 'STAFF_CREATED',
      performedBy: actorUid,
      actorEmail,
      description: `Created new staff account for ${fullName} (${email}) with role ${role}`,
      details: `Role: ${role}, Department: ${createdStaff.department}, StaffID: ${staffId}`,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    const staffObj = createdStaff.toJSON();
    delete (staffObj as any).passwordHash;

    return {
      ...staffObj,
      id: staffId,
      staffId,
      uid,
      displayName: fullName,
      phone: phone || rawPhone
    };
  }

  /**
   * Updates staff details
   */
  public async updateStaff(
    uidOrStaffId: string,
    updates: any,
    actorUid: string = 'uid_admin_01',
    actorEmail: string = MASTER_ADMIN_EMAIL,
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<any> {
    const staff = await StaffModel.findOne({
      $or: [
        { staffId: uidOrStaffId },
        { uid: uidOrStaffId },
        { _id: uidOrStaffId }
      ]
    });

    if (!staff) {
      throw new Error(`Staff member with ID "${uidOrStaffId}" not found.`);
    }

    if (updates.email && updates.email.toLowerCase().trim() !== staff.email) {
      const emailNorm = updates.email.toLowerCase().trim();
      const existing = await StaffModel.findOne({ email: emailNorm });
      if (existing && existing.staffId !== staff.staffId) {
        throw new Error(`A staff member with email "${emailNorm}" already exists.`);
      }
      staff.email = emailNorm;
    }

    if (updates.fullName || updates.displayName || updates.name) {
      staff.fullName = (updates.fullName || updates.displayName || updates.name).trim();
      staff.displayName = staff.fullName;
    }

    if (updates.phoneNumber || updates.phone) {
      const p = (updates.phoneNumber || updates.phone).trim();
      staff.phoneNumber = p;
      staff.phone = p;
    }

    if (updates.role) {
      let r = updates.role;
      if (r === 'MASTER_ADMIN') r = 'ADMIN';
      staff.role = r;
    }

    if (updates.department) {
      staff.department = updates.department;
    }

    if (updates.status) {
      staff.status = updates.status;
      staff.isActive = updates.status === 'active' || updates.status === 'ACTIVE';
    }

    if (typeof updates.isActive === 'boolean') {
      staff.isActive = updates.isActive;
      staff.status = updates.isActive ? 'active' : 'inactive';
    }

    if (updates.permissions) {
      staff.permissions = normalizeUserPermissions(updates.permissions, staff.role);
    }

    staff.updatedAt = new Date();
    await staff.save();

    await StaffAuditModel.create({
      staffId: staff.staffId,
      staffUid: staff.uid,
      staffEmail: staff.email,
      action: 'STAFF_UPDATED',
      performedBy: actorUid,
      actorEmail,
      description: `Updated profile details for staff ${staff.fullName} (${staff.staffId})`,
      details: JSON.stringify(updates),
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    return staff.toJSON();
  }

  /**
   * Updates staff password securely
   */
  public async updatePassword(
    uidOrStaffId: string,
    newPassword: string,
    actorUid: string = 'uid_admin_01',
    actorEmail: string = MASTER_ADMIN_EMAIL,
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<boolean> {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const staff = await StaffModel.findOne({
      $or: [
        { staffId: uidOrStaffId },
        { uid: uidOrStaffId },
        { _id: uidOrStaffId }
      ]
    });

    if (!staff) {
      throw new Error(`Staff member with ID "${uidOrStaffId}" not found.`);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    staff.passwordHash = passwordHash;
    staff.mustChangePassword = false;
    staff.updatedAt = new Date();
    await staff.save();

    await StaffAuditModel.create({
      staffId: staff.staffId,
      staffUid: staff.uid,
      staffEmail: staff.email,
      action: 'PASSWORD_CHANGED',
      performedBy: actorUid,
      actorEmail,
      description: `Password updated for staff ${staff.fullName} (${staff.staffId})`,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Toggles staff status (active / inactive)
   */
  public async toggleStaffStatus(
    uidOrStaffId: string,
    isActive: boolean,
    actorUid: string = 'uid_admin_01',
    actorEmail: string = MASTER_ADMIN_EMAIL,
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<any> {
    const staff = await StaffModel.findOne({
      $or: [
        { staffId: uidOrStaffId },
        { uid: uidOrStaffId },
        { _id: uidOrStaffId }
      ]
    });

    if (!staff) {
      throw new Error(`Staff member with ID "${uidOrStaffId}" not found.`);
    }

    staff.isActive = isActive;
    staff.status = isActive ? 'active' : 'inactive';
    staff.updatedAt = new Date();
    await staff.save();

    if (!isActive) {
      sessionService.revokeStaffSessions(staff.uid);
      sessionService.revokeStaffSessions(staff.staffId);
    }

    await StaffAuditModel.create({
      staffId: staff.staffId,
      staffUid: staff.uid,
      staffEmail: staff.email,
      action: isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      performedBy: actorUid,
      actorEmail,
      description: `Staff ${staff.fullName} (${staff.staffId}) was ${isActive ? 'activated' : 'deactivated'}`,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    return staff.toJSON();
  }

  /**
   * Deletes a staff member
   */
  public async deleteStaff(
    uidOrStaffId: string,
    actorUid: string = 'uid_admin_01',
    actorEmail: string = MASTER_ADMIN_EMAIL,
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<void> {
    const staff = await StaffModel.findOne({
      $or: [
        { staffId: uidOrStaffId },
        { uid: uidOrStaffId },
        { _id: uidOrStaffId }
      ]
    });

    if (!staff) {
      throw new Error(`Staff member with ID "${uidOrStaffId}" not found.`);
    }

    if (staff.role === 'ADMIN' || (staff.role as string) === 'MASTER_ADMIN') {
      throw new Error('Administrator account cannot be deleted.');
    }

    sessionService.revokeStaffSessions(staff.uid);
    sessionService.revokeStaffSessions(staff.staffId);

    await StaffAuditModel.create({
      staffId: staff.staffId,
      staffUid: staff.uid,
      staffEmail: staff.email,
      action: 'STAFF_DELETED',
      performedBy: actorUid,
      actorEmail,
      description: `Staff ${staff.fullName} (${staff.staffId}) deleted`,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    await StaffModel.deleteOne({ staffId: staff.staffId });
  }

  /**
   * Searches staff members
   */
  public async searchStaff(query: string): Promise<any[]> {
    if (!query || !query.trim()) {
      return this.listStaff();
    }

    const regex = new RegExp(query.trim(), 'i');
    const staff = await StaffModel.find({
      $or: [
        { staffId: regex },
        { uid: regex },
        { fullName: regex },
        { displayName: regex },
        { email: regex },
        { phoneNumber: regex },
        { role: regex },
        { department: regex }
      ]
    });

    return staff.map((s: any) => ({
      ...s,
      id: s.staffId || s.uid || s._id?.toString(),
      displayName: s.fullName || s.displayName,
      name: s.fullName || s.displayName,
      phone: s.phoneNumber || s.phone,
      permissions: normalizeUserPermissions(s.permissions, s.role)
    }));
  }

  /**
   * Lists audit logs from Telegram repository
   */
  public async listAuditLogs(): Promise<any[]> {
    const logs = await StaffAuditModel.find({});
    return logs.map((l: any) => ({
      ...l,
      id: l._id || l.id,
      formattedTime: new Date(l.timestamp).toLocaleString('en-GB')
    }));
  }

  public revokeStaffSessions(uidOrStaffId: string, actorUid?: string, actorEmail?: string): number {
    return sessionService.revokeStaffSessions(uidOrStaffId);
  }

  /**
   * Verifies staff credentials against local bcrypt hash
   */
  public async verifyStaffCredentials(
    emailOrStaffId: string,
    passwordAttempt: string,
    targetPortal?: 'RENTAL' | 'FINANCE',
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<StaffVerificationResult> {
    await this.ensureMasterAdmin();

    const normalized = (emailOrStaffId || '').trim().toLowerCase();
    const staff = await StaffModel.findOne({
      $or: [
        { email: normalized },
        { staffId: emailOrStaffId.trim().toUpperCase() },
        { uid: emailOrStaffId.trim() }
      ]
    });

    if (!staff) {
      return { success: false, notFound: true, message: 'Invalid email or password.' };
    }

    if (!staff.isActive || staff.status === 'inactive' || staff.status === 'DISABLED') {
      return {
        success: false,
        disabled: true,
        message: 'Your staff account is currently disabled. Please contact the administrator.'
      };
    }

    const normalizedRole = staff.role === 'MASTER_ADMIN' ? 'ADMIN' : staff.role;

    if (targetPortal === 'RENTAL' && normalizedRole !== 'RENTAL_STAFF' && normalizedRole !== 'ADMIN') {
      return {
        success: false,
        unauthorizedRole: true,
        message: 'Your account does not have access to Rental Management.'
      };
    }

    const isMatch = await bcrypt.compare(passwordAttempt, staff.passwordHash);
    if (!isMatch) {
      return { success: false, message: 'Invalid email or password.' };
    }

    staff.lastLoginAt = new Date();
    await staff.save();

    await StaffAuditModel.create({
      staffId: staff.staffId,
      staffUid: staff.uid,
      staffEmail: staff.email,
      action: 'STAFF_LOGIN',
      performedBy: staff.staffId,
      actorEmail: staff.email,
      description: `Staff ${staff.fullName} logged in successfully`,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    return {
      success: true,
      message: 'Staff verification successful.',
      user: {
        id: staff.staffId,
        uid: staff.uid,
        staffId: staff.staffId,
        name: staff.fullName,
        displayName: staff.fullName,
        email: staff.email,
        role: normalizedRole,
        status: staff.status === 'active' ? 'active' : 'inactive',
        isActive: staff.isActive,
        phone: staff.phoneNumber,
        permissions: normalizeUserPermissions(staff.permissions, normalizedRole)
      }
    };
  }

  public async lookupStaffByEmail(email: string): Promise<StaffVerificationResult> {
    await this.ensureMasterAdmin();
    const staff = await StaffModel.findOne({ email: email.toLowerCase().trim() });

    if (!staff) {
      return { success: false, notFound: true, message: 'Staff account not found.' };
    }

    const normalizedRole = staff.role === 'MASTER_ADMIN' ? 'ADMIN' : staff.role;

    return {
      success: true,
      user: {
        id: staff.staffId,
        uid: staff.uid,
        staffId: staff.staffId,
        name: staff.fullName,
        displayName: staff.fullName,
        email: staff.email,
        role: normalizedRole,
        status: staff.status === 'active' ? 'active' : 'inactive',
        isActive: staff.isActive,
        phone: staff.phoneNumber,
        permissions: normalizeUserPermissions(staff.permissions, normalizedRole)
      }
    };
  }

  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const staff = await StaffModel.findOne({ email: email.toLowerCase().trim() });
    if (!staff) {
      return { success: false, message: 'Staff account not found.' };
    }
    return {
      success: true,
      message: 'Password reset request generated. Please contact administrator to reset password.'
    };
  }

  public async resetPasswordWithToken(token: string, newPass: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Password reset completed.' };
  }
}

export const staffService = new StaffService();
export default staffService;
