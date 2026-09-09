# Complex & Shop Rental Management Module

## 1. System Overview

The **Complex & Shop Rental Management** module is an enterprise multi-property ledger integrated into the unified backend and frontend. It handles commercial properties, shop units, tenant agreements, monthly billings, advance credits, cash and UPI/GPay splits, maintenance expenses, and financial summaries.

---

## 2. Entity Model & Deterministic IDs

All rental records use sequential human-readable IDs:

| Entity | Prefix / Format | Description |
| :--- | :--- | :--- |
| **Complex** | `CMP-0001` | Commercial complex building, location, total units, ownership details |
| **Shop** | `SHOP-0001` | Commercial unit, tenant name, phone, monthly rent amount, advance balance |
| **Rent Payment** | `PAY-0001` | Rent transaction, billing period, Cash/GPay split, advance accrued & used |
| **Expense** | `EXP-0001` | Operating expense (electricity, plumbing, maintenance, municipal taxes) |
| **Audit Log** | `AUD-0001` | Immutable user audit trail |

---

## 3. Financial Calculation & Payment Logic

All financial computations are performed deterministically by the backend:

- **Outstanding Balance**:
  $$\text{Balance} = \max(0, \text{Monthly Rent} - \text{Covered Amount} - \text{Advance Applied})$$
- **Advance Generation**: Any surplus paid over the required monthly rent is credited to `availableAdvance`.
- **Advance Utilization**: When paying rent, available advance credits can be applied to offset cash/digital payment amounts.
- **Split Payment Verification**:
  - `CASH`: 100% Cash payment.
  - `GPAY`: 100% UPI / Digital payment.
  - `BOTH`: Verified that $\text{Cash Amount} + \text{GPay Amount} == \text{Total Amount Paid}$.

---

## 4. API Endpoints

All rental endpoints are mounted under `/api/rental`:

- `GET /api/rental/complexes` - List all commercial complexes
- `POST /api/rental/complexes` - Create a new complex
- `GET /api/rental/shops` - List shops (supports filtering by complex)
- `POST /api/rental/shops` - Add shop unit with tenant terms
- `GET /api/rental/payments` - Rent payment history
- `POST /api/rental/payments` - Record new rent collection with advance credit support
- `GET /api/rental/expenses` - Maintenance and utility expenses
- `POST /api/rental/expenses` - Record property expense
- `GET /api/rental/reports/summary` - Aggregate monthly income, pending collections, and expense totals
