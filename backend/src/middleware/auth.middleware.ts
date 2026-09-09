import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel, IUser, IUserPermissions, UserRole, normalizeUserPermissions } from '../models/User.js';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id?: string;
        id: string;
        uid?: string;
        staffId: string;
        email: string;
        name: string;
        displayName?: string;
        role: UserRole;
        permissions: IUserPermissions;
        mustChangePassword?: boolean;
        department?: string;
      };
    }
  }
}

export interface JwtPayload {
  sub?: string;
  id?: string;
  uid?: string;
  email: string;
  role: UserRole | 'MASTER_ADMIN';
  iat?: number;
  exp?: number;
}

/**
 * Authenticates user via Bearer JWT token in Authorization header.
 * Loads fresh state from MongoDB on every request to ensure immediate revocation / permission update.
 */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || (req.headers.Authorization as string);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication token is required. Please sign in.'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Malformed authorization token.'
      });
      return;
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please sign in again.'
        });
        return;
      }
      res.status(401).json({
        success: false,
        error: 'TOKEN_INVALID',
        message: 'Invalid authentication token.'
      });
      return;
    }

    const userId = decoded.sub || decoded.id || decoded.uid;
    const userEmail = decoded.email?.toLowerCase().trim();

    const user = await UserModel.findOne({
      $or: [
        ...(userId ? [{ _id: userId }, { staffId: userId }, { uid: userId }] : []),
        ...(userEmail ? [{ email: userEmail }] : [])
      ]
    }).lean() as IUser | null;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User account no longer exists.'
      });
      return;
    }

    if (!user.isActive || user.status === 'inactive' || (user.status as string) === 'DISABLED') {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated. Please contact an Administrator.'
      });
      return;
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

    const normalizedPermissions = normalizeUserPermissions(user.permissions, normalizedRole);

    req.user = {
      _id: user._id?.toString(),
      id: user.staffId || user.uid || user._id?.toString(),
      uid: user.uid || user.staffId,
      staffId: user.staffId,
      email: user.email,
      name: user.fullName || user.displayName || user.name || 'User',
      displayName: user.displayName || user.fullName,
      role: normalizedRole,
      permissions: normalizedPermissions,
      mustChangePassword: user.mustChangePassword === true,
      department: user.department
    };

    next();
  } catch (err: any) {
    console.error('[AuthMiddleware] Error during authentication:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Authentication service encountered an error.'
    });
  }
};

/**
 * Enforces Role-Based Access Control (RBAC).
 * ADMIN role automatically bypasses.
 */
export const authorizeRoles = (...roles: Array<UserRole | 'MASTER_ADMIN' | string>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required before checking permissions.'
      });
      return;
    }

    const userRole = req.user.role;
    // ADMIN has full superadmin access
    if (userRole === 'ADMIN') {
      return next();
    }

    // Check if role is in allowed roles
    const normalizedRoles = roles.map((r) => (r === 'MASTER_ADMIN' ? 'ADMIN' : r));
    if (normalizedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: `Access denied. This action requires one of the following roles: ${roles.join(', ')}. Your current role is ${userRole}.`
    });
  };
};

/**
 * Enforces fine-grained module-action authorization.
 * ADMIN role automatically bypasses.
 * Checks req.user.permissions[module][action] === true.
 */
export const authorizePermission = (module: string, action: string = 'view') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required before checking permissions.'
      });
      return;
    }

    // ADMIN has full bypass across all modules
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const perms = req.user.permissions as any;
    if (perms && perms[module] && perms[module][action] === true) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: `Access denied. You do not have '${action}' permission for the '${module}' module.`
    });
  };
};

export default { authenticateUser, authorizeRoles, authorizePermission };
