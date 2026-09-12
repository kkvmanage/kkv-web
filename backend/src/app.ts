import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { getHealth } from './controllers/health.controller.js';

const app = express();

// ── Allowed Origins Allowlist ───────────────────────────────────────────────
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://testingfrontend.duckdns.org',
  'https://kkv-smoky.vercel.app'
];

const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true; // allow non-browser / mobile / desktop same-origin calls
  if (allowedOriginsSet.has(origin)) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  if (origin.endsWith('.vercel.app') || origin.endsWith('.duckdns.org')) return true;
  return false;
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'user-role',
    'user-id',
    'user-name',
    'x-actor-uid',
    'x-actor-email',
    'x-idempotency-key',
    'Accept',
    'X-Requested-With',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  maxAge: 86400
};

// ── 1. Robust Standard CORS & OPTIONS Preflight Middleware ──────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── 2. Security Headers (configured safely for cross-origin APIs) ───────────
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: '10mb' }));

// Database Auto-Connect Middleware (transparently reconnects if state was idle/disconnected)
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/') {
    return next();
  }
  try {
    const { ensureMongoConnected } = await import('./config/database.js');
    await ensureMongoConnected();
  } catch (err) {
    // Handled by downstream controller or readyState check
  }
  next();
});

// Root Information Endpoint
app.get('/', (req: Request, res: Response) => {

  res.json({
    success: true,
    message: 'KKV Gold Finance API is running'
  });
});

// Direct Health Endpoint
app.get('/health', getHealth);
app.get('/api/health', getHealth);

// Mount API routes at /api and root fallback
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.path} not found`,
    error: { code: 'NOT_FOUND' }
  });
});

// Centralized Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Error]:', err);
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: { code: err.code || 'INTERNAL_SERVER_ERROR' }
  });
});

export default app;
