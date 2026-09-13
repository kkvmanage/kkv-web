import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel, IUser, UserRole, normalizeUserPermissions } from '../models/User.js';
import { sessionService } from '../services/session.service.js';
import { localAuthService } from '../services/localAuth.service.js';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, username, id, password } = req.body || {};
    const identifier = (email || username || id || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Email / Staff ID and password are required.'
      });
    }

    // Ensure default seeded accounts exist with valid bcrypt hashes
    await localAuthService.seedDefaultUsers();

    // Find user by email or staffId or uid or id
    const user = await UserModel.findOne({
      $or: [
        { email: identifier },
        { staffId: identifier.toUpperCase() },
        { uid: identifier },
        { _id: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // Check account status
    if (!user.isActive || user.status === 'inactive' || (user.status as string) === 'DISABLED') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated. Please contact an Administrator.'
      });
    }

    // Defensive check: verify password hash exists and is a valid bcrypt format
    if (!user.passwordHash || typeof user.passwordHash !== 'string' || !user.passwordHash.trim()) {
      console.error(`[AuthController] Security Alert: User "${user.email || user.staffId}" has no passwordHash configured.`);
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // Verify password against stored bcrypt hash safely
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } catch (bcryptErr) {
      console.error('[AuthController] bcrypt.compare error:', bcryptErr);
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // Normalize role
    let normalizedRole: UserRole = 'STAFF';
    const rawRole = (user.role as string || '').toUpperCase();
    if (rawRole === 'ADMIN' || rawRole === 'MASTER_ADMIN') {
      normalizedRole = 'ADMIN';
    } else if (rawRole === 'RENTAL_STAFF') {
      normalizedRole = 'RENTAL_STAFF';
    } else {
      normalizedRole = 'STAFF';
    }

    // Generate JWT access token
    const payload = {
      sub: (user._id || user.staffId).toString(),
      id: user.staffId || user.uid,
      staffId: user.staffId,
      email: user.email,
      role: normalizedRole
    };

    const token = jwt.sign(payload, env.JWT_SECRET as string, {
      expiresIn: (env.JWT_EXPIRES_IN || '24h') as any
    });

    // Update lastLoginAt while preserving passwordHash
    user.lastLoginAt = new Date().toISOString();
    await user.save();

    // Register active device session
    const sessionId = `sess_${(user.staffId || 'usr').toLowerCase()}_${Date.now()}`;
    sessionService.registerSession({
      sessionId,
      userId: user.staffId || user.uid,
      userRole: normalizedRole,
      userEmail: user.email,
      ipAddress: req.ip || req.socket?.remoteAddress || '',
      browser: (req.headers['user-agent'] as string) || 'Web Browser',
      status: 'ACTIVE'
    });

    // Safe user payload for frontend (never exposes passwordHash)
    const userJson = user.toJSON ? user.toJSON() : { ...user };
    delete (userJson as any).passwordHash;
    delete (userJson as any).save;

    const normalizedPermissions = normalizeUserPermissions(user.permissions, normalizedRole);

    return res.status(200).json({
      success: true,
      token,
      role: normalizedRole,
      user: {
        ...userJson,
        role: normalizedRole,
        permissions: normalizedPermissions
      },
      message: 'Login successful.'
    });
  } catch (err: any) {
    console.error('[AuthController] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Unable to sign in right now. Please try again.'
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Not authenticated.'
      });
    }

    const user = await UserModel.findOne({
      $or: [
        { staffId: req.user.id },
        { uid: req.user.id },
        { email: req.user.email }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'User record not found.'
      });
    }

    let normalizedRole: UserRole = 'STAFF';
    const rawRole = (user.role as string || '').toUpperCase();
    if (rawRole === 'ADMIN' || rawRole === 'MASTER_ADMIN') {
      normalizedRole = 'ADMIN';
    } else if (rawRole === 'RENTAL_STAFF') {
      normalizedRole = 'RENTAL_STAFF';
    } else {
      normalizedRole = 'STAFF';
    }

    const userJson = user.toJSON ? user.toJSON() : { ...user };
    delete (userJson as any).passwordHash;
    delete (userJson as any).save;

    const normalizedPermissions = normalizeUserPermissions(user.permissions, normalizedRole);

    return res.status(200).json({
      success: true,
      user: {
        ...userJson,
        role: normalizedRole,
        permissions: normalizedPermissions
      }
    });
  } catch (err: any) {
    console.error('[AuthController] getMe error:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve user profile.'
    });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Both current password and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'WEAK_PASSWORD',
        message: 'New password must be at least 6 characters long.'
      });
    }

    const user = await UserModel.findOne({
      $or: [
        { staffId: req.user.id },
        { uid: req.user.id },
        { email: req.user.email }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'User account not found.'
      });
    }

    if (!user.passwordHash || typeof user.passwordHash !== 'string' || !user.passwordHash.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INCORRECT_PASSWORD',
        message: 'Incorrect current password.'
      });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'INCORRECT_PASSWORD',
        message: 'Incorrect current password.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newHash;
    user.mustChangePassword = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err: any) {
    console.error('[AuthController] changePassword error:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to change password.'
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user?.id) {
      sessionService.revokeStaffSessions(req.user.id);
    }
    return res.status(200).json({
      success: true,
      message: 'Successfully logged out.'
    });
  } catch (err: any) {
    console.error('[AuthController] logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'Logout completed.'
    });
  }
};

export default { login, getMe, changePassword, logout };
