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
 * Loads fresh state from local Auth store on every request to ensure immediate revocation / permission update.
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

    const orClauses: any[] = [];
    if (userId) {
      orClauses.push({ _id: userId });
      orClauses.push({ staffId: userId });
      orClauses.push({ uid: userId });
    }
    if (userEmail) {
      orClauses.push({ email: userEmail });
    }

    const user = orClauses.length > 0
      ? ((await UserModel.findOne({ $or: orClauses })) as IUser | null)
      : null;

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
      id: user.staffId || user.uid || user._id?.toString() || 'USER',
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
 * Checks whether user permissions allow the given module and action.
 * Maps synonyms (e.g. fd -> fixedDeposits, daybook/accounting -> dayBook, receipts -> loans/dayBook, etc.)
 */
export function hasPermission(
  perms: IUserPermissions | undefined,
  module: string,
  action: string = 'view',
  role: string = 'STAFF'
): boolean {
  if (!perms) return false;
  const upperRole = (role || '').toUpperCase();
  if (upperRole === 'ADMIN' || upperRole === 'MASTER_ADMIN') return true;

  const m = (module || '').toLowerCase().trim();
  const a = (action || 'view').toLowerCase().trim();

  // 1. Dashboard summary
  if (m === 'dashboard') {
    if (a === 'view') {
      return Boolean(
        perms.customers?.view ||
        perms.loans?.view ||
        perms.fixedDeposits?.view ||
        perms.dayBook?.view ||
        perms.reports?.view ||
        perms.rental?.view
      );
    }
    return false;
  }

  // 2. Customers
  if (m === 'customers' || m === 'customer') {
    if (a === 'view') return Boolean(perms.customers?.view);
    if (a === 'create' || a === 'add') return Boolean(perms.customers?.create);
    if (a === 'update' || a === 'edit') return Boolean(perms.customers?.edit);
    if (a === 'delete') return Boolean(perms.customers?.delete);
    return false;
  }

  // 3. Loans
  if (m === 'loans' || m === 'loan') {
    if (a === 'view') return Boolean(perms.loans?.view);
    if (a === 'create' || a === 'issue' || a === 'add') return Boolean(perms.loans?.issue);
    if (a === 'update' || a === 'edit') return Boolean(perms.loans?.edit);
    if (a === 'close' || a === 'approve') return Boolean(perms.loans?.close);
    if (a === 'reopen') return Boolean(perms.loans?.reopen);
    if (a === 'delete') return false; // Non-admin cannot delete loans
    return false;
  }

  // 4. Fixed Deposits
  if (m === 'fd' || m === 'fixeddeposit' || m === 'fixeddeposits' || m === 'fixed_deposits') {
    if (a === 'view') return Boolean(perms.fixedDeposits?.view);
    if (a === 'create' || a === 'add') return Boolean(perms.fixedDeposits?.create);
    if (a === 'update' || a === 'edit') {
      return Boolean(perms.fixedDeposits?.edit || perms.fixedDeposits?.withdraw || perms.fixedDeposits?.renew);
    }
    if (a === 'withdraw') return Boolean(perms.fixedDeposits?.withdraw || perms.fixedDeposits?.edit);
    if (a === 'renew') return Boolean(perms.fixedDeposits?.renew || perms.fixedDeposits?.edit);
    if (a === 'delete') return Boolean(perms.fixedDeposits?.edit);
    return false;
  }

  // 5. Receipts
  if (m === 'receipts' || m === 'receipt') {
    if (a === 'view') return Boolean(perms.loans?.view || perms.dayBook?.view);
    if (a === 'create' || a === 'add') {
      return Boolean(perms.loans?.issue || perms.loans?.edit || perms.dayBook?.addEntry);
    }
    return false;
  }

  // 6. Accounting / Day Book
  if (m === 'accounting' || m === 'daybook' || m === 'day_book') {
    if (a === 'view') return Boolean(perms.dayBook?.view || perms.reports?.view);
    if (a === 'create' || a === 'add' || a === 'addentry') return Boolean(perms.dayBook?.addEntry);
    if (a === 'update' || a === 'edit' || a === 'editentry') return Boolean(perms.dayBook?.editEntry);
    if (a === 'delete' || a === 'deleteentry') return Boolean(perms.dayBook?.deleteEntry);
    return false;
  }

  // 7. Rental
  if (m === 'rental' || m === 'rentals' || m === 'rent') {
    if (a === 'view') return Boolean(perms.rental?.view);
    if (a === 'create' || a === 'add') {
      return Boolean(perms.rental?.manageComplexes || perms.rental?.collectRent || perms.rental?.manageExpenses);
    }
    if (a === 'update' || a === 'edit') {
      return Boolean(perms.rental?.manageComplexes || perms.rental?.collectRent || perms.rental?.manageExpenses);
    }
    if (a === 'delete') return Boolean(perms.rental?.manageExpenses || perms.rental?.manageComplexes);
    if (a === 'managecomplexes') return Boolean(perms.rental?.manageComplexes);
    if (a === 'collectrent') return Boolean(perms.rental?.collectRent);
    if (a === 'manageexpenses') return Boolean(perms.rental?.manageExpenses);
    if (a === 'reports') return Boolean(perms.rental?.reports);
    return false;
  }

  // 8. Staff Management
  if (m === 'staff' || m === 'staffmanagement' || m === 'staff_management') {
    if (a === 'view') return Boolean(perms.staffManagement?.view);
    if (a === 'create') return Boolean(perms.staffManagement?.create);
    if (a === 'update' || a === 'edit') return Boolean(perms.staffManagement?.edit);
    if (a === 'delete') return Boolean(perms.staffManagement?.delete);
    if (a === 'togglestatus') return Boolean(perms.staffManagement?.toggleStatus);
    return false;
  }

  // 9. Reports
  if (m === 'reports' || m === 'report') {
    if (a === 'view') return Boolean(perms.reports?.view);
    if (a === 'export') return Boolean(perms.reports?.export);
    return false;
  }

  // 10. Settings
  if (m === 'settings' || m === 'setting' || m === 'config') {
    if (a === 'view') return Boolean(perms.settings?.view);
    if (a === 'update' || a === 'edit') return Boolean(perms.settings?.editRates || perms.settings?.editCompany);
    return false;
  }

  // 11. Backup / Restore
  if (m === 'backup' || m === 'backups' || m === 'backuprestore' || m === 'backup_restore') {
    if (a === 'create' || a === 'createbackup') return Boolean(perms.backupRestore?.createBackup);
    if (a === 'restore' || a === 'restorebackup') return Boolean(perms.backupRestore?.restoreBackup);
    return false;
  }

  // Direct lookup fallback on perms object
  const rawPerms = perms as any;
  if (rawPerms[module] && typeof rawPerms[module] === 'object') {
    if (rawPerms[module][action] === true) return true;
  }

  return false;
}

/**
 * Enforces Role-Based Access Control (RBAC).
 * ADMIN role automatically bypasses.
 */
export const authorizeRoles = (...roles: Array<UserRole | 'MASTER_ADMIN' | string>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.warn(`[Auth] path=${req.originalUrl || req.path} user=anonymous role=none authenticated=false allowed=false (No session)`);
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required before checking permissions.'
      });
      return;
    }

    const userRole = req.user.role;
    if (userRole === 'ADMIN') {
      console.log(`[Auth] path=${req.originalUrl || req.path} user=${req.user.staffId || req.user.id} role=${userRole} authenticated=true requiredRoles=${roles.join(',')} allowed=true (Admin bypass)`);
      return next();
    }

    const normalizedRoles = roles.map((r) => (r === 'MASTER_ADMIN' ? 'ADMIN' : r));
    if (normalizedRoles.includes(userRole)) {
      console.log(`[Auth] path=${req.originalUrl || req.path} user=${req.user.staffId || req.user.id} role=${userRole} authenticated=true requiredRoles=${roles.join(',')} allowed=true`);
      return next();
    }

    console.warn(`[Auth] path=${req.originalUrl || req.path} user=${req.user.staffId || req.user.id} role=${userRole} authenticated=true requiredRoles=${roles.join(',')} allowed=false`);
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
 * Uses normalized permission mapping.
 */
export const authorizePermission = (module: string, action: string = 'view') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.warn(`[Auth] path=${req.originalUrl || req.path} user=anonymous role=none authenticated=false requiredPermission=${module}.${action} allowed=false (No session)`);
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required before checking permissions.'
      });
      return;
    }

    const isAllowed = hasPermission(req.user.permissions, module, action, req.user.role);

    console.log(
      `[Auth] path=${req.originalUrl || req.path} user=${req.user.staffId || req.user.id} role=${req.user.role} authenticated=true requiredPermission=${module}.${action} allowed=${isAllowed}`
    );

    if (isAllowed) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: `Access denied. You do not have '${action}' permission for the '${module}' module.`
    });
  };
};

export default { authenticateUser, authorizeRoles, authorizePermission, hasPermission };
