import { Request, Response } from 'express';
import { staffService } from '../services/staff.service.js';
import { isTelegramStorageReady } from '../config/database.js';

export const getStaffList = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const list = await staffService.listStaff();
    return res.json({ success: true, data: list, count: list.length });
  } catch (err: any) {
    console.error('[StaffController] getStaffList error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to retrieve staff list.' });
  }
};

export const getStaffProfile = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const { uid } = req.params;
    const user = await staffService.getStaffByUid(uid);
    if (!user) {
      return res.status(404).json({ success: false, message: `Staff member "${uid}" not found.` });
    }
    return res.json({ success: true, data: user });
  } catch (err: any) {
    console.error('[StaffController] getStaffProfile error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const body = req.body || {};
    const email = (body.email || '').trim().toLowerCase();
    const fullName = (body.fullName || body.displayName || body.name || '').trim();
    const role = body.role || 'STAFF';
    const phone = (body.phoneNumber || body.phone || '').trim();
    const password = body.password || body.initialPassword || '';
    const permissions = body.permissions;
    const department = body.department;

    const actorUid = (req.headers['x-actor-uid'] as string) || (req.headers['user-id'] as string) || 'uid_master_admin_01';
    const actorEmail = (req.headers['x-actor-email'] as string) || (req.headers['user-email'] as string) || 'admin@kkvgoldfinance.com';
    const ipAddress = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    if (!fullName) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required.' });
    }

    const created = await staffService.createStaff(
      {
        fullName,
        displayName: fullName,
        email,
        role,
        phoneNumber: phone,
        phone,
        password,
        permissions,
        department
      },
      actorUid,
      actorEmail,
      ipAddress,
      userAgent
    );

    return res.status(201).json({
      success: true,
      data: created,
      message: 'Staff account created successfully.'
    });
  } catch (err: any) {
    console.error('[StaffController] createStaff error:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to create staff account.' });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const { uid } = req.params;
    const updates = req.body || {};
    const actorUid = (req.headers['x-actor-uid'] as string) || (req.headers['user-id'] as string) || 'uid_master_admin_01';
    const actorEmail = (req.headers['x-actor-email'] as string) || (req.headers['user-email'] as string) || 'admin@kkvgoldfinance.com';
    const ipAddress = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const updated = await staffService.updateStaff(uid, updates, actorUid, actorEmail, ipAddress, userAgent);
    return res.json({ success: true, data: updated, message: 'Staff profile updated successfully.' });
  } catch (err: any) {
    console.error('[StaffController] updateStaff error:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to update staff profile.' });
  }
};

export const updateStaffPassword = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const { uid } = req.params;
    const { password, newPassword } = req.body;
    const targetPassword = newPassword || password;

    if (!targetPassword) {
      return res.status(400).json({ success: false, message: 'New password is required.' });
    }

    const actorUid = (req.headers['x-actor-uid'] as string) || 'uid_master_admin_01';
    const actorEmail = (req.headers['x-actor-email'] as string) || 'admin@kkvgoldfinance.com';
    const ipAddress = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    await staffService.updatePassword(uid, targetPassword, actorUid, actorEmail, ipAddress, userAgent);
    return res.json({ success: true, message: 'Staff password updated successfully.' });
  } catch (err: any) {
    console.error('[StaffController] updateStaffPassword error:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to update password.' });
  }
};

export const toggleStaffStatus = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const { uid } = req.params;
    const { isActive, status } = req.body;
    const targetActive = typeof isActive === 'boolean' ? isActive : status === 'active' || status === 'ACTIVE';

    const actorUid = (req.headers['x-actor-uid'] as string) || 'uid_master_admin_01';
    const actorEmail = (req.headers['x-actor-email'] as string) || 'admin@kkvgoldfinance.com';
    const ipAddress = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const updated = await staffService.toggleStaffStatus(uid, targetActive, actorUid, actorEmail, ipAddress, userAgent);
    return res.json({
      success: true,
      data: updated,
      message: `Staff account successfully ${targetActive ? 'activated' : 'deactivated'}.`
    });
  } catch (err: any) {
    console.error('[StaffController] toggleStaffStatus error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const revokeStaffSessions = (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const count = staffService.revokeStaffSessions(uid);
    return res.json({
      success: true,
      revokedCount: count,
      message: `Successfully revoked ${count} active session(s) for this staff member.`
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const { uid } = req.params;
    const actorUid = (req.headers['x-actor-uid'] as string) || 'uid_master_admin_01';
    const actorEmail = (req.headers['x-actor-email'] as string) || 'admin@kkvgoldfinance.com';
    const ipAddress = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    await staffService.deleteStaff(uid, actorUid, actorEmail, ipAddress, userAgent);
    return res.json({ success: true, message: 'Staff account deleted permanently.' });
  } catch (err: any) {
    console.error('[StaffController] deleteStaff error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const searchStaff = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const query = ((req.query.query || req.query.q) as string || '').trim();
    const results = await staffService.searchStaff(query);
    return res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    console.error('[StaffController] searchStaff error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Search failed.' });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    if (!isTelegramStorageReady()) {
      return res.status(503).json({
        success: false,
        message: 'Storage is currently initializing.',
        error: { code: 'STORAGE_INITIALIZING' }
      });
    }

    const logs = await staffService.listAuditLogs();
    return res.json({ success: true, data: logs, count: logs.length });
  } catch (err: any) {
    console.error('[StaffController] getAuditLogs error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to retrieve audit logs.' });
  }
};

export const verifyStaffCredentials = async (req: Request, res: Response) => {
  try {
    const { email, password, username, id } = req.body || {};
    const emailOrStaffId = email || username || id;

    if (!emailOrStaffId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Staff ID and password are required.'
      });
    }

    const targetPortal = req.body?.targetPortal || (req.headers['x-target-portal'] as string) || (req.body?.portal === 'RENTAL' ? 'RENTAL' : undefined);
    const ipAddress = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await staffService.verifyStaffCredentials(emailOrStaffId, password, targetPortal as any, ipAddress, userAgent);

    if (!result.success) {
      if (result.disabled) {
        return res.status(403).json({
          success: false,
          disabled: true,
          message: result.message || 'Your staff account is currently disabled. Please contact the administrator.'
        });
      }
      if (result.unauthorizedRole) {
        return res.status(403).json({
          success: false,
          unauthorizedRole: true,
          message: result.message || 'Your account does not have access to this portal.'
        });
      }
      return res.status(401).json({
        success: false,
        message: result.message || 'Invalid email/Staff ID or password.'
      });
    }

    return res.status(200).json({
      success: true,
      user: result.user,
      message: 'Staff verification successful.'
    });
  } catch (err: any) {
    console.error('[StaffController] verifyStaffCredentials error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error during staff verification.'
    });
  }
};

export const lookupStaff = async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email || req.params?.email || req.query?.email || '') as string;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const result = await staffService.lookupStaffByEmail(email);

    if (!result.success) {
      return res.status(404).json({ success: false, notFound: true, message: result.message || 'Staff account not found.' });
    }

    return res.status(200).json({ success: true, user: result.user, message: 'Staff lookup successful.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Internal server error during staff lookup.' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    const result = await staffService.requestPasswordReset(email);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to request password reset.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }
    const result = await staffService.resetPasswordWithToken(token, newPassword);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to reset password.' });
  }
};
