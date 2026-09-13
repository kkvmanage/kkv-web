# Authentication & Role-Based Access Control (RBAC)

## 1. Architectural Overview

KKV Gold Finance & Rental Management utilizes a secure, centralized, standalone authentication system:
- **Authentication**: Custom backend authentication with bcrypt password hashing (10 salt rounds) and signed JSON Web Tokens (JWT).
- **Security & User Store**: Local encrypted user store (`data/auth/users.json`) managed via `localAuthService`. Passwords and auth secrets are never stored in or transmitted over Telegram.
- **RBAC Matrix**: Role-based access control with granular permissions (`ADMIN`, `STAFF`, `RENTAL_STAFF`).
- **Zero Third-Party Auth Dependencies**: No Firebase Auth, no external OAuth requirements.

```
                         [ USER LOGIN ]
                                |
                     POST /api/auth/login
                                |
                  [ Custom Backend Auth ]
              (Bcrypt Hash Check & Validation)
                                |
                   [ JWT Signed Access Token ]
                                |
          +---------------------+---------------------+
          |                     |                     |
      [ ADMIN ]             [ STAFF ]          [ RENTAL_STAFF ]
          |                     |                     |
     <Admin Portal>       <Staff Portal>       <Rental Portal>
   - Full Access        - Operations         - Complex & Shops
   - Staff Mgmt         - Loans & KYC        - Rent Collections
   - Rates & Master     - Receipts & FD      - Maintenance Exp
   - Backup & Restore   - Day Book           - Rental Reports
```

---

## 2. Identity & Credential Specification

- **User Store**: User profiles and bcrypt hashes are persisted securely in local backend storage (`data/auth/users.json`).
- **Bcrypt Security**: Passwords are saved as bcrypt hashes (`passwordHash`) with minimum 6 characters. Hashes and raw passwords are never returned in API responses or stored in Telegram envelopes.
- **Login Identifiers**: Users can log in using either their registered **Email** or **Staff ID** (e.g., `KKV-STAFF-000001`, `KKV-RS-000001`, `KKV-ADMIN-000001`).
- **Sequential IDs**:
  - `STAFF` $\rightarrow$ `KKV-STAFF-XXXXXX`
  - `RENTAL_STAFF` $\rightarrow$ `KKV-RS-XXXXXX`
  - `ADMIN` $\rightarrow$ `KKV-ADMIN-XXXXXX`
- **Active State Enforcement**: Deactivated accounts (`isActive: false`) are rejected at login and on protected routes without destroying credentials.

---

## 3. Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates via Email or Staff ID + password; returns JWT token and profile. |
| `GET` | `/api/auth/me` | Authenticated | Returns current user profile with role and permissions. |
| `POST` | `/api/auth/change-password` | Authenticated | Self-service password change (validates current password, updates to new). |
| `POST` | `/api/auth/logout` | Authenticated | Terminates session context. |
| `GET` | `/api/staff` | **ADMIN Only** | Retrieves full staff directory with roles, departments, and statuses. |
| `POST` | `/api/staff` | **ADMIN Only** | Creates new staff account with auto-generated ID (STAFF / RENTAL_STAFF only). |
| `PUT` / `POST` | `/api/staff/:uid/password` | **ADMIN Only** | Resets staff password with immediate bcrypt persistence. |
| `PATCH` | `/api/staff/:uid/status` | **ADMIN Only** | Toggles staff active/inactive status. |

---

## 4. Default Seed Accounts

On initial startup, the backend automatically initializes the standard administrative and operational accounts if not already present:
- **Master Admin**: `admin@kkvgoldfinance.com` (Role: `ADMIN`)
- **Finance Staff**: `staff@kkvgoldfinance.com` (Role: `STAFF`)
- **Rental Staff**: `rental@kkvgoldfinance.com` (Role: `RENTAL_STAFF`)
