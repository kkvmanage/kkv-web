import { localAuthService } from '../services/localAuth.service.js';

export async function seedUsers() {
  console.log('--- KKV Gold Finance & Rental Management: Seeding Default Users ---');
  await localAuthService.seedDefaultUsers();
  console.log('[Seed] All authentication accounts verified in local encrypted auth store.');
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
