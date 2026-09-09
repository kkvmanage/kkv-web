# KKV Gold Finance & Rental Management System

Enterprise-grade Non-Banking Financial Company (NBFC) & Commercial Real Estate Management Platform.

---

## 1. Project Architecture

The repository is organized into a clean, decoupled architecture:
- **Frontend (`/src`)**: Single-page application built with **React 18 + Vite + TypeScript + Lucide Icons**.
- **Backend (`/backend`)**: Express.js REST API with **MongoDB Atlas / Local MongoDB**, **bcrypt** password encryption, and **Custom JWT Authentication with RBAC**.
- **Single Source of Truth**: Centralized MongoDB persistence with automated migrations and seeding.

```
kkv/
├── backend/
│   ├── src/
│   │   ├── config/             # Database, environment, storage configuration
│   │   ├── controllers/        # REST API request handlers
│   │   ├── middleware/         # Auth, validation, RBAC, error handlers
│   │   ├── models/             # Mongoose schemas & TypeScript interfaces
│   │   ├── modules/            # Domain modules (Gold Finance & Rental)
│   │   ├── routes/             # API route registries
│   │   ├── scripts/            # Database seed and maintenance scripts
│   │   ├── services/           # Business logic and database operations
│   │   ├── types/              # Backend TypeScript definitions
│   │   ├── utils/              # Sequential ID generators, hashing helpers
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # HTTP server bootstrap & initialization
│   ├── .env                    # Backend environment variables & secrets (NOT committed)
│   ├── .env.example            # Backend environment template
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                       # Detailed architectural documentation
│   ├── AUTHENTICATION.md       # Custom JWT, RBAC & Staff credentials guide
│   └── RENTAL_MANAGEMENT.md    # Commercial complexes, shops, rent & advance ledger
│
├── public/                     # Static frontend assets & branding
├── src/                        # React TypeScript frontend
├── .env.development            # Local development frontend configuration
├── .env.production             # Production frontend configuration
├── .env.example                # Frontend environment template
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 2. Quick Start & Development Setup

### Prerequisites
- Node.js $\ge 18.0.0$
- MongoDB $\ge 6.0$ (running locally at `mongodb://127.0.0.1:27017` or MongoDB Atlas URI)

### Installation & Execution

1. **Install Dependencies**:
   ```bash
   # Install root / frontend dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

2. **Configure Environment Variables**:
   - Backend: Copy `backend/.env.example` to `backend/.env` and update `MONGODB_URI` and `JWT_SECRET`.
   - Frontend: Ensure `VITE_API_BASE_URL=http://localhost:8080/api` in `.env.development`.

3. **Start Development Servers**:
   ```bash
   # Terminal 1: Backend Server (Port 8080)
   cd backend
   npm run dev

   # Terminal 2: Frontend Server (Port 5173)
   npm run dev
   ```

---

## 3. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Backend HTTP port | `8080` |
| `NODE_ENV` | Runtime environment mode | `development` / `production` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/kkv_gold_finance` |
| `MONGODB_DB_NAME` | Primary database name | `kkv_gold_finance` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your_secure_random_key_512` |
| `JWT_ACCESS_EXPIRES_IN` | Token expiration duration | `24h` / `15m` |
| `ADMIN_NAME` | Master administrator display name | `KKV Master Admin` |
| `ADMIN_EMAIL` | Master administrator login email | `admin@kkvgoldfinance.com` |
| `ADMIN_PASSWORD` | Master administrator default password | `Admin@123456` |
| `LOCAL_STORAGE_PATH` | Local data/file vault directory | `./data` |

### Frontend (`.env.development` / `.env.production`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Public backend API URL | `http://localhost:8080/api` |
| `VITE_APP_NAME` | Application Title | `KKV Gold Finance` |
| `VITE_APP_ENV` | Frontend environment tag | `development` / `production` |

---

## 4. Default Seeded Credentials

| Portal / Role | Login Identifier | Default Password | Initial Permissions |
| :--- | :--- | :--- | :--- |
| **Master Admin** | `admin@kkvgoldfinance.com` or `KKV-ADMIN-000001` | `Admin@123456` | Full administrative control & staff management |
| **Operations Staff** | `staff@kkvgoldfinance.com` or `KKV-STAFF-000001` | `Staff@123456` | Gold Loans, Customers, FD, Day Book |
| **Rental Staff** | `rental@kkvgoldfinance.com` or `KKV-RS-000001` | `Rental@123456` | Complexes, Shops, Rent Ledger, Maintenance |

---

## 5. Build & Production Verification

```bash
# Verify Backend TypeScript Compilation
cd backend
npm run build

# Verify Frontend Production Bundle
cd ..
npm run build
```
