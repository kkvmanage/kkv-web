import app from '../src/app.js';
import { ensureMongoConnected } from '../src/config/database.js';

// Warm up database connection on serverless cold start
ensureMongoConnected().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.warn('[Vercel Serverless] MongoDB warmup notice:', message);
});

export default app;
