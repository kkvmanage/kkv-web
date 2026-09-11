import { env, validateStartupConfig } from './config/env.js';
import { connectDB, isMongoConnected } from './config/database.js';
import { seedUsers } from './scripts/seedAdmin.js';
import app from './app.js';

async function startServer() {
  console.log('[Startup] Initializing KKV Gold Finance & Rental Management Backend...');

  // 1. Startup validation
  const validation = validateStartupConfig();
  if (!validation.isValid) {
    console.error(`[Startup Validation] ❌ Missing required configuration: ${validation.missingVars.join(', ')}`);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // 2. Connect to MongoDB and AWAIT confirmation before starting Express
  try {
    await connectDB();
    console.log('[Startup] MongoDB connection confirmed.');
    
    // 3. Seed default admin & staff users if needed
    try {
      await seedUsers();
    } catch (seedErr: any) {
      console.warn('[Startup Seed] User seeding warning:', seedErr?.message || seedErr);
    }
  } catch (dbErr: any) {
    console.error('[Startup] Failed to establish MongoDB connection:', dbErr?.message || dbErr);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // 4. Start Express server only after database is initialized
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[KKV Gold Finance Backend] Express server running at http://localhost:${env.PORT}`);
    console.log(`[KKV Gold Finance Backend] API Base: http://localhost:${env.PORT}/api`);
    console.log(`[KKV Gold Finance Backend] Health Endpoint: http://localhost:${env.PORT}/api/health`);
  });
}

startServer();
