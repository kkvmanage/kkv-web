# KKV GOLD FINANCE & RENTAL MANAGEMENT
## Local Development & Environment Setup Guide

This document outlines the local development setup, environment variable specifications, and security boundaries for **KKV Gold Finance & Rental Management**.

---

## 1. Target Localhost Architecture

```
┌───────────────────────────────┐
│           Browser             │
│    http://localhost:5173      │
└──────────────┬────────────────┘
               │  VITE_API_URL=http://localhost:8080/api
               ▼
┌───────────────────────────────┐
│     Local Backend Server      │
│     http://localhost:8080     │
└───────┬───────────────┬───────┘
        │               │
        │ MongoDB       │ REST API (Backend Only)
        ▼               ▼
┌───────────────┐ ┌───────────────────────────┐
│ Local MongoDB │ │    Google Drive API       │
│ 127.0.0.1     │ │  (External Binary Vault)  │
│ Port 27017    │ │   KYC / Photos / PDFs     │
│ DB:           │ └───────────────────────────┘
│ kkv_gold_     │
│ finance       │
└───────────────┘
```

- **Frontend**: `http://localhost:5173` (Vite + React)
- **Backend**: `http://localhost:8080` (Node.js + Express + TypeScript)
- **Authoritative Database**: Local MongoDB running at `mongodb://127.0.0.1:27017/kkv_gold_finance`
- **Database Name**: `kkv_gold_finance`
- **Google Drive**: External cloud storage accessed **strictly via backend** for physical binary files (KYC documents, photos, receipts). No Google Drive credentials or secrets exist in the frontend.

---

## 2. Environment Variables Specification

### A. Frontend Environment (`.env` / `.env.local`)
| Variable | Scope | Secret | Description | Local Development Value |
|---|---|---|---|---|
| `VITE_API_URL` | Frontend Public | No | Primary backend REST API URL | `http://localhost:8080/api` |
| `VITE_API_BASE_URL` | Frontend Public | No | Fallback alias for API URL | `http://localhost:8080/api` |

> [!IMPORTANT]
> **Zero Frontend Secrets**: No database connection strings, JWT secrets, passwords, or Google Cloud private keys may ever be placed in frontend environment files.

---

### B. Backend Environment (`backend/.env`)
| Variable | Scope | Secret | Description | Local Development Value |
|---|---|---|---|---|
| `PORT` | Backend Only | No | Express server listening port | `8080` |
| `NODE_ENV` | Backend Only | No | Node execution environment | `development` |
| `FRONTEND_URL` | Backend Only | No | Local frontend URL for callbacks | `http://localhost:5173` |
| `CORS_ORIGIN` / `CORS_ALLOWED_ORIGINS` | Backend Only | No | Allowed frontend origins for CORS | `http://localhost:5173,http://127.0.0.1:5173` |
| `MONGODB_URI` | Backend Only | **YES** | Local MongoDB connection URI | `mongodb://127.0.0.1:27017/kkv_gold_finance` |
| `MONGODB_DB_NAME` | Backend Only | No | Target database name | `kkv_gold_finance` |
| `RENTAL_MONGODB_DB_NAME` | Backend Only | No | Target rental database name | `kkv_gold_finance` |
| `JWT_SECRET` | Backend Only | **YES** | Cryptographic key for JWT tokens | `kkv_gold_finance_rbac_secure_jwt_secret_2026_super_key_512` |
| `JWT_EXPIRES_IN` | Backend Only | No | JWT access token expiration | `15m` |
| `ADMIN_NAME` | Backend Only | No | Master Admin bootstrap name | `KKV Master Admin` |
| `ADMIN_EMAIL` | Backend Only | No | Master Admin email address | `admin@kkvgoldfinance.com` |
| `ADMIN_PASSWORD` | Backend Only | **YES** | Master Admin seed password | `Admin@123456` |
| `LOCAL_STORAGE_PATH` | Backend Only | No | Local fallback repository path | `./data` |
| `GOOGLE_CLOUD_PROJECT_ID` | Backend Only | No | Google Cloud Project ID | `kkv-gold-507605` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Backend Only | No | Google Drive Service Account | `kkv-finance@kkv-gold-507605.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Backend Only | **YES** | Google Service Account Private Key | `""` (or configure for Drive uploads) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Backend Only | No | Google Drive root folder ID | `""` (or configure for Drive uploads) |

---

## 3. Local Development Startup

### 1. Start Local MongoDB
Ensure MongoDB is running locally on port 27017:
```bash
mongod --dbpath /data/db
```

### 2. Start Backend Server
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:8080 (API Base: http://localhost:8080/api)
```

### 3. Start Frontend App
```bash
# In project root
npm install
npm run dev
# Running on http://localhost:5173
```
