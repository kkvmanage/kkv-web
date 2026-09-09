import app from '../backend/src/app.js';
import { ensureMongoConnected } from '../backend/src/config/database.js';

// Warm up database connection on serverless cold start
ensureMongoConnected().catch((err: unknown) => {
  console.warn('[Vercel Serverless] MongoDB warmup notice:', (err as Error)?.message || String(err));
});

export default app;
