import { env, validateStartupConfig } from './config/env.js';
import { connectDB } from './config/database.js';
import { localAuthService } from './services/localAuth.service.js';
import app from './app.js';

async function startServer() {
  console.log('[Startup] Initializing KKV Gold Finance & Rental Management Backend...');
  console.log('[Startup] Persistence Mode: Telegram Bot API (Shared Remote Storage)');

  // 1. Startup validation
  const validation = validateStartupConfig();
  if (!validation.isValid) {
    console.warn(`[Startup Validation] ⚠️ Notice: Configuration missing: ${validation.missingVars.join(', ')}`);
    console.warn('Backend will run with local fallback until TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are provided.');
  }

  // 2. Initialize Telegram storage connection & multi-PC sync
  try {
    await connectDB();
  } catch (err: any) {
    console.warn('[Startup] Storage initialization notice:', err?.message || err);
  }

  // 3. Seed default local authentication accounts (Admin, Staff, Rental Staff)
  try {
    await localAuthService.seedDefaultUsers();
    console.log('[Startup] Local RBAC accounts verified.');
  } catch (seedErr: any) {
    console.warn('[Startup Seed] User seeding notice:', seedErr?.message || seedErr);
  }

  // 4. Start Express server
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[KKV Gold Finance Backend] Express server running at http://localhost:${env.PORT}`);
    console.log(`[KKV Gold Finance Backend] API Base: http://localhost:${env.PORT}/api`);
    console.log(`[KKV Gold Finance Backend] Health Endpoint: http://localhost:${env.PORT}/api/health`);
  });
}

startServer();
