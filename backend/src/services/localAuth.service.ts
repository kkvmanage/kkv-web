import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { getStorageSubdirectory, ensureDirectoryExists } from '../config/storage.js';
import {
  IUser,
  UserRole,
  ADMIN_DEFAULT_PERMISSIONS,
  STAFF_DEFAULT_PERMISSIONS,
  RENTAL_STAFF_DEFAULT_PERMISSIONS,
  getDefaultPermissionsForRole,
  normalizeUserPermissions
} from '../models/User.js';
import { telegramRepository } from '../telegram/telegram.repository.js';

const MASTER_ADMIN_EMAIL = 'admin@kkvgoldfinance.com';

export class LocalAuthService {
  private authDir: string;
  private usersFilePath: string;
  private usersCache: Map<string, IUser> = new Map(); // key: staffId or uid or email

  constructor() {
    this.authDir = getStorageSubdirectory('auth');
    this.usersFilePath = path.join(this.authDir, 'users.json');
    this.initStorage();
  }

  private initStorage(): void {
    try {
      ensureDirectoryExists(this.authDir);
      if (fs.existsSync(this.usersFilePath)) {
        const raw = fs.readFileSync(this.usersFilePath, 'utf-8');
        const list = JSON.parse(raw) as IUser[];
        this.populateCache(list);
      } else {
        this.persistUsers([]);
      }
    } catch (err) {
      console.warn('[LocalAuthService] Storage initialization warning:', err);
    }
  }

  private populateCache(users: IUser[]): void {
    this.usersCache.clear();
    for (const u of users) {
      if (u.staffId) this.usersCache.set(u.staffId.toLowerCase(), u);
      if (u.uid) this.usersCache.set(u.uid.toLowerCase(), u);
      if (u.email) this.usersCache.set(u.email.toLowerCase().trim(), u);
      if ((u as any)._id) this.usersCache.set(String((u as any)._id), u);
    }
  }

  private persistUsers(users: IUser[]): void {
    try {
      ensureDirectoryExists(this.authDir);
      const tempPath = `${this.usersFilePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(users, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.usersFilePath);
      this.populateCache(users);
    } catch (err) {
      console.warn('[LocalAuthService] Error persisting users to disk:', err);
    }
  }

  /**
   * Retrieves all users, merging local disk cache with shared Telegram storage records
   */
  public getAllUsers(): IUser[] {
    let localUsers: IUser[] = [];
    try {
      if (fs.existsSync(this.usersFilePath)) {
        const raw = fs.readFileSync(this.usersFilePath, 'utf-8');
        localUsers = JSON.parse(raw) as IUser[];
      }
    } catch (err) {
      console.warn('[LocalAuthService] Local read error:', err);
      localUsers = Array.from(new Set(this.usersCache.values()));
    }

    // Merge with Telegram repository if available (for multi-PC updates)
    try {
      const telegramUsers = telegramRepository.getRecords<IUser>('USER');
      if (telegramUsers && telegramUsers.length > 0) {
        const mergedMap = new Map<string, IUser>();
        // Add local users first
        for (const u of localUsers) {
          const key = (u.staffId || u.email || u.uid).toLowerCase();
          mergedMap.set(key, u);
        }
        // Merge telegram users (authoritative shared state)
        for (const tu of telegramUsers) {
          const key = (tu.staffId || tu.email || tu.uid).toLowerCase();
          const existing = mergedMap.get(key);
          if (!existing) {
            mergedMap.set(key, tu);
          } else {
            // Update if telegram has passwordHash or newer data
            mergedMap.set(key, {
              ...existing,
              ...tu,
              passwordHash: (tu.passwordHash && tu.passwordHash.trim()) || existing.passwordHash
            });
          }
        }
        const mergedList = Array.from(mergedMap.values());
        if (mergedList.length !== localUsers.length) {
          this.persistUsers(mergedList);
        }
        return mergedList;
      }
    } catch {
      // If Telegram is currently initializing, proceed with local users
    }

    return localUsers;
  }

  public listUsers(): IUser[] {
    return this.getAllUsers();
  }

  public findUserByIdentifier(identifier: string): IUser | null {
    if (!identifier) return null;
    const clean = identifier.toLowerCase().trim();
    const users = this.getAllUsers();
    return (
      users.find(
        (u) =>
          (u.staffId && u.staffId.toLowerCase() === clean) ||
          (u.uid && u.uid.toLowerCase() === clean) ||
          (u.email && u.email.toLowerCase() === clean) ||
          (u._id && String(u._id).toLowerCase() === clean)
      ) || null
    );
  }

  public findUserByEmail(email: string): IUser | null {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    const users = this.getAllUsers();
    return users.find((u) => u.email && u.email.toLowerCase() === clean) || null;
  }

  /**
   * Automatically seeds default Admin, Staff, and Rental Staff with verified bcrypt hashes
   */
  public async seedDefaultUsers(): Promise<void> {
    const users = this.getAllUsers();
    let hasModifications = false;

    // 1. Admin account
    const adminEmail = (env.ADMIN_EMAIL || MASTER_ADMIN_EMAIL).trim().toLowerCase();
    let adminIndex = users.findIndex(
      (u) => (u.email && u.email.toLowerCase() === adminEmail) || u.role === 'ADMIN' || u.role === 'MASTER_ADMIN'
    );

    if (adminIndex === -1) {
      const adminPassword = env.ADMIN_PASSWORD || 'Admin@123456';
      const adminHash = await bcrypt.hash(adminPassword, 10);
      const newAdmin: IUser = {
        _id: 'user_admin_001',
        staffId: 'KKV-ADMIN-000001',
        uid: 'uid_admin_001',
        fullName: env.ADMIN_NAME || 'KKV Master Admin',
        displayName: env.ADMIN_NAME || 'KKV Master Admin',
        email: adminEmail,
        phoneNumber: '9876543210',
        phone: '9876543210',
        role: 'ADMIN',
        passwordHash: adminHash,
        status: 'active',
        isActive: true,
        mustChangePassword: false,
        permissions: ADMIN_DEFAULT_PERMISSIONS,
        department: 'Administration',
        createdByUid: 'INITIAL_SEED',
        createdByEmail: 'system@kkvgoldfinance.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      users.push(newAdmin);
      hasModifications = true;
      console.log('[LocalAuth] Admin user seeded successfully:', adminEmail);
    } else {
      // Verify existing Admin has valid bcrypt password hash
      const adminUser = users[adminIndex];
      if (!adminUser.passwordHash || !adminUser.passwordHash.startsWith('$2')) {
        const adminPassword = env.ADMIN_PASSWORD || 'Admin@123456';
        adminUser.passwordHash = await bcrypt.hash(adminPassword, 10);
        adminUser.updatedAt = new Date().toISOString();
        users[adminIndex] = adminUser;
        hasModifications = true;
        console.log('[LocalAuth] Repaired missing bcrypt password hash for Admin account');
      }
    }

    // 2. Finance Staff account
    const staffEmail = 'staff@kkvgoldfinance.com';
    let staffIndex = users.findIndex((u) => u.email && u.email.toLowerCase() === staffEmail);

    if (staffIndex === -1) {
      const staffPassword = 'Staff@123456';
      const staffHash = await bcrypt.hash(staffPassword, 10);
      const newStaff: IUser = {
        _id: 'user_staff_001',
        staffId: 'KKV-STAFF-000099',
        uid: 'uid_staff_001',
        fullName: 'Finance Operations Staff',
        displayName: 'Finance Staff',
        email: staffEmail,
        phoneNumber: '9876543211',
        phone: '9876543211',
        role: 'STAFF',
        passwordHash: staffHash,
        status: 'active',
        isActive: true,
        mustChangePassword: false,
        permissions: STAFF_DEFAULT_PERMISSIONS,
        department: 'Finance Operations',
        createdByUid: 'INITIAL_SEED',
        createdByEmail: 'system@kkvgoldfinance.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      users.push(newStaff);
      hasModifications = true;
      console.log('[LocalAuth] Staff user seeded successfully:', staffEmail);
    } else {
      // Verify existing Staff has valid bcrypt password hash
      const staffUser = users[staffIndex];
      if (!staffUser.passwordHash || !staffUser.passwordHash.startsWith('$2')) {
        staffUser.passwordHash = await bcrypt.hash('Staff@123456', 10);
        staffUser.updatedAt = new Date().toISOString();
        users[staffIndex] = staffUser;
        hasModifications = true;
        console.log('[LocalAuth] Repaired missing bcrypt password hash for Staff account');
      }
    }

    // 3. Rental Staff account
    const rentalEmail = 'rental@kkvgoldfinance.com';
    let rentalIndex = users.findIndex((u) => u.email && u.email.toLowerCase() === rentalEmail);

    if (rentalIndex === -1) {
      const rentalPassword = 'Rental@123456';
      const rentalHash = await bcrypt.hash(rentalPassword, 10);
      const newRental: IUser = {
        _id: 'user_rental_001',
        staffId: 'KKV-RENTAL-000001',
        uid: 'uid_rental_001',
        fullName: 'Rental Complex Manager',
        displayName: 'Rental Staff',
        email: rentalEmail,
        phoneNumber: '9876543212',
        phone: '9876543212',
        role: 'RENTAL_STAFF',
        passwordHash: rentalHash,
        status: 'active',
        isActive: true,
        mustChangePassword: false,
        permissions: RENTAL_STAFF_DEFAULT_PERMISSIONS,
        department: 'Rental Management',
        createdByUid: 'INITIAL_SEED',
        createdByEmail: 'system@kkvgoldfinance.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      users.push(newRental);
      hasModifications = true;
      console.log('[LocalAuth] Rental Staff user seeded successfully:', rentalEmail);
    } else {
      // Verify existing Rental Staff has valid bcrypt password hash
      const rentalUser = users[rentalIndex];
      if (!rentalUser.passwordHash || !rentalUser.passwordHash.startsWith('$2')) {
        rentalUser.passwordHash = await bcrypt.hash('Rental@123456', 10);
        rentalUser.updatedAt = new Date().toISOString();
        users[rentalIndex] = rentalUser;
        hasModifications = true;
        console.log('[LocalAuth] Repaired missing bcrypt password hash for Rental Staff account');
      }
    }

    if (hasModifications) {
      this.persistUsers(users);
      // Sync default users to shared Telegram storage
      for (const u of users) {
        this.syncUserToTelegram(u).catch(() => {});
      }
    }
  }

  /**
   * Persists a user to local store and propagates to Telegram repository
   */
  public async saveUser(user: IUser): Promise<IUser> {
    const users = this.getAllUsers();
    const index = users.findIndex(
      (u) =>
        (u.staffId && user.staffId && u.staffId.toLowerCase() === user.staffId.toLowerCase()) ||
        (u.uid && user.uid && u.uid.toLowerCase() === user.uid.toLowerCase()) ||
        (user._id && u._id === user._id) ||
        (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase())
    );

    const existing = index >= 0 ? users[index] : null;

    // Resolve and safeguard password hash
    let passwordHash = user.passwordHash;
    if (!passwordHash || typeof passwordHash !== 'string' || !passwordHash.trim()) {
      if (existing && existing.passwordHash && existing.passwordHash.trim()) {
        passwordHash = existing.passwordHash;
      } else {
        // Fallback default password hash if not provided
        passwordHash = await bcrypt.hash('Staff@123456', 10);
      }
    } else if (!passwordHash.startsWith('$2')) {
      // Plaintext password passed - automatically hash with bcrypt (10 rounds)
      passwordHash = await bcrypt.hash(passwordHash, 10);
    }

    const now = new Date().toISOString();
    const updatedUser: IUser = {
      ...(existing || {}),
      ...user,
      passwordHash,
      updatedAt: now
    };

    if (index >= 0) {
      users[index] = updatedUser;
    } else {
      users.push(updatedUser);
    }

    this.persistUsers(users);

    // Sync to shared Telegram storage
    await this.syncUserToTelegram(updatedUser);

    return updatedUser;
  }

  /**
   * Syncs user record to Telegram storage for multi-PC access
   */
  private async syncUserToTelegram(user: IUser): Promise<void> {
    try {
      const entityId = user.staffId || user.uid || user._id || `user_${Date.now()}`;
      const existingTg = telegramRepository.getRecordById('USER', entityId);
      if (existingTg) {
        await telegramRepository.updateRecord('USER', entityId, user);
      } else {
        await telegramRepository.createRecord('USER', entityId, user);
      }
    } catch (err: any) {
      // Ignore conflict or log notice; local store remains authoritative fallback
      console.warn('[LocalAuthService] Telegram user persistence notice:', err?.message || err);
    }
  }

  public async deleteUser(identifier: string): Promise<boolean> {
    const users = this.getAllUsers();
    const clean = identifier.toLowerCase().trim();
    const filtered = users.filter(
      (u) =>
        u.staffId.toLowerCase() !== clean &&
        u.uid.toLowerCase() !== clean &&
        u.email.toLowerCase() !== clean &&
        String(u._id).toLowerCase() !== clean
    );

    if (filtered.length !== users.length) {
      this.persistUsers(filtered);
      telegramRepository.deleteRecord('USER', identifier, false).catch(() => {});
      return true;
    }
    return false;
  }
}

export const localAuthService = new LocalAuthService();
export default localAuthService;
