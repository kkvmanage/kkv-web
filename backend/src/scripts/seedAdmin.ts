import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { ensureMongoConnected } from '../config/database.js';
import {
  UserModel,
  ADMIN_DEFAULT_PERMISSIONS,
  STAFF_DEFAULT_PERMISSIONS,
  RENTAL_STAFF_DEFAULT_PERMISSIONS
} from '../models/User.js';

export async function seedUsers() {
  console.log('--- KKV Gold Finance & Rental Management: Seeding Default Users ---');

  if (!env.MONGODB_URI) {
    console.error('Error: MONGODB_URI environment variable is required.');
    return;
  }

  await ensureMongoConnected();

  // 1. Seed/Update ADMIN User (admin@kkvgoldfinance.com)
  const adminEmail = (env.ADMIN_EMAIL || 'admin@kkvgoldfinance.com').trim().toLowerCase();
  const adminPassword = env.ADMIN_PASSWORD || 'Admin@123456';
  const adminHash = await bcrypt.hash(adminPassword, 10);

  let adminUser = await UserModel.findOne({ email: adminEmail });
  if (!adminUser) {
    adminUser = await UserModel.create({
      staffId: 'KKV-ADMIN-000001',
      uid: 'uid_admin_001',
      fullName: 'KKV Master Admin',
      displayName: 'KKV Master Admin',
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
      createdByEmail: 'system@kkvgoldfinance.com'
    });
    console.log('[Seed] Admin user created successfully: ' + adminEmail);
  } else {
    adminUser.passwordHash = adminHash;
    adminUser.isActive = true;
    adminUser.status = 'active';
    adminUser.role = 'ADMIN';
    adminUser.permissions = ADMIN_DEFAULT_PERMISSIONS;
    await adminUser.save();
    console.log('[Seed] Admin user synchronized: ' + adminEmail);
  }

  // 2. Seed/Update STAFF User (staff@kkvgoldfinance.com)
  const staffEmail = 'staff@kkvgoldfinance.com';
  const staffPassword = 'Staff@123456';
  const staffHash = await bcrypt.hash(staffPassword, 10);

  let staffUser = await UserModel.findOne({ email: staffEmail });
  if (!staffUser) {
    staffUser = await UserModel.create({
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
      createdByEmail: 'system@kkvgoldfinance.com'
    });
    console.log('[Seed] Staff user created successfully: ' + staffEmail);
  } else {
    staffUser.passwordHash = staffHash;
    staffUser.isActive = true;
    staffUser.status = 'active';
    staffUser.role = 'STAFF';
    staffUser.permissions = STAFF_DEFAULT_PERMISSIONS;
    await staffUser.save();
    console.log('[Seed] Staff user synchronized: ' + staffEmail);
  }

  // 3. Seed/Update RENTAL_STAFF User (rental@kkvgoldfinance.com)
  const rentalEmail = 'rental@kkvgoldfinance.com';
  const rentalPassword = 'Rental@123456';
  const rentalHash = await bcrypt.hash(rentalPassword, 10);

  let rentalUser = await UserModel.findOne({ email: rentalEmail });
  if (!rentalUser) {
    rentalUser = await UserModel.create({
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
      createdByEmail: 'system@kkvgoldfinance.com'
    });
    console.log('[Seed] Rental Staff user created successfully: ' + rentalEmail);
  } else {
    rentalUser.passwordHash = rentalHash;
    rentalUser.isActive = true;
    rentalUser.status = 'active';
    rentalUser.role = 'RENTAL_STAFF';
    rentalUser.permissions = RENTAL_STAFF_DEFAULT_PERMISSIONS;
    await rentalUser.save();
    console.log('[Seed] Rental Staff user synchronized: ' + rentalEmail);
  }

  console.log('[Seed] All default users verified and ready.');
}

if (process.argv[1] && process.argv[1].includes('seedAdmin')) {
  seedUsers()
    .then(() => {
      console.log('Seeding finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

export default seedUsers;
