# KKV Gold Finance & Rental Management System

Enterprise-grade Non-Banking Financial Company (NBFC) & Commercial Real Estate Management Platform with distributed **Telegram Bot API Remote Persistent Storage**.

---

## 1. Project Architecture

The application is organized into a clean, decoupled architecture:
- **Frontend (`/src`)**: Single-page application built with **React 18 + Vite + TypeScript + Lucide Icons**.
- **Local Backend (`/backend`)**: Express.js REST API with **Telegram Bot API persistent storage**, **bcrypt** password encryption, and **Custom JWT Authentication with RBAC**.
- **Remote Source of Truth**: Shared private Telegram storage channel with automated envelope synchronization across multiple independent PC workstations (Staff PC 1, Staff PC 2, Admin PC, Rental PC).

```
kkv/
├── backend/
│   ├── src/
│   │   ├── config/             # Environment, storage, and Telegram configuration
│   │   ├── controllers/        # REST API request handlers
│   │   ├── middleware/         # Auth, validation, RBAC, error handlers
│   │   ├── models/             # Entity models & TypeScript interfaces
│   │   ├── modules/            # Domain modules (Gold Finance & Rental)
│   │   ├── routes/             # API route registries
│   │   ├── telegram/           # Telegram Bot API client, parser, cache, sync engine & repository
│   │   ├── services/           # Business logic and storage operations
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
- Telegram Bot Token & Private Channel Chat ID

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
   - Backend: Copy `backend/.env.example` to `backend/.env` and configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `JWT_SECRET`.
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
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API Token (Backend only) | `123456789:ABCdefGHIjkl...` |
| `TELEGRAM_CHAT_ID` | Telegram Storage Channel Chat ID | `-1001234567890` |
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
| `VITE_API_URL` | Public backend API URL | `http://localhost:8080/api` |
