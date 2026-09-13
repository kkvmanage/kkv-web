import app from '../src/app.js';
import { ensureStorageConnected } from '../src/config/database.js';

// Warm up storage connection on serverless cold start
ensureStorageConnected().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.warn('[Vercel Serverless] Telegram storage warmup notice:', message);
});

export default app;
