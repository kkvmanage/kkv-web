import { localAuthService } from '../services/localAuth.service.js';

export type UserRole = 'ADMIN' | 'MASTER_ADMIN' | 'STAFF' | 'RENTAL_STAFF';

export interface IUserPermissions {
  customers: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  loans: {
    view: boolean;
    issue: boolean;
    edit: boolean;
    close: boolean;
    reopen: boolean;
  };
  fixedDeposits: {
    view: boolean;
    create: boolean;
    edit: boolean;
    withdraw: boolean;
    renew: boolean;
  };
  rental: {
    view: boolean;
    manageComplexes: boolean;
    collectRent: boolean;
    manageExpenses: boolean;
    reports: boolean;
  };
  dayBook: {
    view: boolean;
    addEntry: boolean;
    editEntry: boolean;
    deleteEntry: boolean;
  };
  staffManagement: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    toggleStatus: boolean;
  };
  reports: {
    view: boolean;
    export: boolean;
  };
  settings: {
    view: boolean;
    editRates: boolean;
    editCompany: boolean;
  };
  backupRestore: {
    createBackup: boolean;
    restoreBackup: boolean;
  };
}

export const ADMIN_DEFAULT_PERMISSIONS: IUserPermissions = {
  customers: { view: true, create: true, edit: true, delete: true },
  loans: { view: true, issue: true, edit: true, close: true, reopen: true },
  fixedDeposits: { view: true, create: true, edit: true, withdraw: true, renew: true },
  rental: { view: true, manageComplexes: true, collectRent: true, manageExpenses: true, reports: true },
  dayBook: { view: true, addEntry: true, editEntry: true, deleteEntry: true },
  staffManagement: { view: true, create: true, edit: true, delete: true, toggleStatus: true },
  reports: { view: true, export: true },
  settings: { view: true, editRates: true, editCompany: true },
  backupRestore: { createBackup: true, restoreBackup: true }
};

export const STAFF_DEFAULT_PERMISSIONS: IUserPermissions = {
  customers: { view: true, create: true, edit: true, delete: false },
  loans: { view: true, issue: true, edit: false, close: true, reopen: false },
  fixedDeposits: { view: true, create: true, edit: false, withdraw: true, renew: true },
  rental: { view: false, manageComplexes: false, collectRent: false, manageExpenses: false, reports: false },
  dayBook: { view: true, addEntry: true, editEntry: false, deleteEntry: false },
  staffManagement: { view: false, create: false, edit: false, delete: false, toggleStatus: false },
  reports: { view: true, export: false },
  settings: { view: false, editRates: false, editCompany: false },
  backupRestore: { createBackup: false, restoreBackup: false }
};

export const RENTAL_STAFF_DEFAULT_PERMISSIONS: IUserPermissions = {
  customers: { view: false, create: false, edit: false, delete: false },
  loans: { view: false, issue: false, edit: false, close: false, reopen: false },
  fixedDeposits: { view: false, create: false, edit: false, withdraw: false, renew: false },
  rental: { view: true, manageComplexes: true, collectRent: true, manageExpenses: true, reports: true },
  dayBook: { view: true, addEntry: true, editEntry: false, deleteEntry: false },
  staffManagement: { view: false, create: false, edit: false, delete: false, toggleStatus: false },
  reports: { view: true, export: true },
  settings: { view: false, editRates: false, editCompany: false },
  backupRestore: { createBackup: false, restoreBackup: false }
};

export const getDefaultPermissionsForRole = (role?: string): IUserPermissions => {
  if (!role) return STAFF_DEFAULT_PERMISSIONS;
  const upper = role.toUpperCase();
  if (upper === 'ADMIN' || upper === 'MASTER_ADMIN') return ADMIN_DEFAULT_PERMISSIONS;
  if (upper === 'RENTAL_STAFF') return RENTAL_STAFF_DEFAULT_PERMISSIONS;
  return STAFF_DEFAULT_PERMISSIONS;
};

export const normalizePermissions = (rawPermissions: any = {}, role: string = 'STAFF'): IUserPermissions => {
  const baseDefaults = getDefaultPermissionsForRole(role);
  return {
    customers: { ...baseDefaults.customers, ...(rawPermissions.customers || {}) },
    loans: { ...baseDefaults.loans, ...(rawPermissions.loans || {}) },
    fixedDeposits: { ...baseDefaults.fixedDeposits, ...(rawPermissions.fixedDeposits || {}) },
    rental: { ...baseDefaults.rental, ...(rawPermissions.rental || {}) },
    dayBook: { ...baseDefaults.dayBook, ...(rawPermissions.dayBook || {}) },
    staffManagement: { ...baseDefaults.staffManagement, ...(rawPermissions.staffManagement || {}) },
    reports: { ...baseDefaults.reports, ...(rawPermissions.reports || {}) },
    settings: { ...baseDefaults.settings, ...(rawPermissions.settings || {}) },
    backupRestore: { ...baseDefaults.backupRestore, ...(rawPermissions.backupRestore || {}) }
  };
};

export const normalizeUserPermissions = normalizePermissions;

export interface IUser {
  _id?: string;
  id?: string;
  staffId: string;
  uid: string;
  fullName: string;
  displayName?: string;
  name?: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  role: UserRole | string;
  passwordHash: string;
  status: 'active' | 'inactive';
  isActive: boolean;
  mustChangePassword?: boolean;
  permissions: IUserPermissions;
  department?: string;
  lastLoginAt?: Date | string;
  createdByUid?: string;
  createdByEmail?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  save?: () => Promise<IUser>;
  toJSON?: () => any;
}

export class UserModel {
  public static findOne(query: any): any {
    const users = localAuthService.getAllUsers();
    const match = users.find((u) => {
      if (query.$or && Array.isArray(query.$or)) {
        return query.$or.some((clause: any) => UserModel.matchesClause(u, clause));
      }
      return UserModel.matchesClause(u, query);
    });

    const wrapped = match ? UserModel.wrapUser(match) : null;
    const chain = {
      select: () => chain,
      lean: async () => match,
      then: (resolve: any, reject?: any) => Promise.resolve(wrapped).then(resolve, reject)
    };
    return chain;
  }

  public static find(query: any = {}): any {
    let users = localAuthService.getAllUsers();
    if (Object.keys(query).length > 0) {
      users = users.filter((u) => {
        if (query.$or && Array.isArray(query.$or)) {
          return query.$or.some((clause: any) => UserModel.matchesClause(u, clause));
        }
        return UserModel.matchesClause(u, query);
      });
    }

    const wrapped = users.map((u) => UserModel.wrapUser(u));

    const chain = {
      sort: () => chain,
      select: () => chain,
      lean: async () => users,
      then: (resolve: any, reject?: any) => Promise.resolve(wrapped).then(resolve, reject)
    };
    return chain;
  }

  public static async create(data: Partial<IUser>): Promise<any> {
    const user: IUser = {
      _id: data._id || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      staffId: data.staffId || `STAFF-${Date.now()}`,
      uid: data.uid || `uid_${Date.now()}`,
      fullName: data.fullName || data.name || data.displayName || 'User',
      displayName: data.displayName || data.fullName || 'User',
      email: (data.email || '').toLowerCase().trim(),
      phoneNumber: data.phoneNumber || data.phone || '',
      phone: data.phoneNumber || data.phone || '',
      role: data.role || 'STAFF',
      passwordHash: data.passwordHash || '',
      status: data.status || 'active',
      isActive: data.isActive ?? true,
      mustChangePassword: data.mustChangePassword ?? false,
      permissions: data.permissions || getDefaultPermissionsForRole(data.role),
      department: data.department || 'Finance Operations',
      createdByUid: data.createdByUid || 'SYSTEM',
      createdByEmail: data.createdByEmail || 'system@kkvgoldfinance.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await localAuthService.saveUser(user);
    return UserModel.wrapUser(saved);
  }

  public static async deleteOne(query: any): Promise<any> {
    const user = await UserModel.findOne(query);
    if (user) {
      await localAuthService.deleteUser(user.staffId || user.email);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  public static async deleteMany(_query: any): Promise<any> {
    return { deletedCount: 0 };
  }

  private static matchesClause(user: IUser, clause: any): boolean {
    if (!clause || typeof clause !== 'object') return false;
    for (const key of Object.keys(clause)) {
      const val = clause[key];
      if (key === 'email') {
        if ((user.email || '').toLowerCase() !== String(val).toLowerCase()) return false;
      } else if (key === 'staffId') {
        if ((user.staffId || '').toUpperCase() !== String(val).toUpperCase()) return false;
      } else if (key === 'uid') {
        if ((user.uid || '').toLowerCase() !== String(val).toLowerCase()) return false;
      } else if (key === '_id' || key === 'id') {
        if (String(user._id || user.uid || '').toLowerCase() !== String(val).toLowerCase()) return false;
      } else if (key === 'role') {
        if (String(user.role).toUpperCase() !== String(val).toUpperCase()) return false;
      } else if (key === 'isActive') {
        if (Boolean(user.isActive) !== Boolean(val)) return false;
      } else if ((user as any)[key] !== val) {
        return false;
      }
    }
    return true;
  }

  private static wrapUser(user: IUser): any {
    return {
      ...user,
      id: user.uid || user._id,
      _id: user._id || user.uid,
      save: async function () {
        return localAuthService.saveUser(this);
      },
      toJSON: function () {
        const copy = { ...this };
        delete copy.passwordHash;
        delete copy.save;
        delete copy.toJSON;
        return copy;
      }
    };
  }
}

export default UserModel;
