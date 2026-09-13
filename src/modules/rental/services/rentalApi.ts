import {
  RentalComplex,
  RentalShop,
  RentalPayment,
  RentalExpense,
  RentalDashboardData,
  AdminRentalSummary,
  MonthlyRentReportItem,
  PaymentModeReportData,
  SyncSummary,
  RentalStatus,
  ExpenseCategory,
  ExpenseScope,
  PaymentMode,
  RentalDayBookFilter,
  RentalDayBookResponse,
  RentalDayBookEntry,
  PendingRentResponse,
  ShopSettlementSummary,
  ComplexDeleteCheck,
  ShopDeleteCheck,
  RentalNotification
} from '../types/rental.types';
import { getApiBaseUrl, getStoredAuthToken } from '../../../services/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const token = getStoredAuthToken();
    const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, message: json.message || `Request failed with status ${res.status}` };
    }
    return json;
  } catch (err: any) {
    console.error(`[rentalApi] Error calling ${endpoint}:`, err);
    return { success: false, message: err.message || 'Network error occurred' };
  }
}

export const rentalApi = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard: async (month?: string, complexId?: string) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (complexId) params.append('complexId', complexId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<RentalDashboardData>(`/rental/dashboard${query}`);
  },

  // ── Complexes ──────────────────────────────────────────────────────────────
  getComplexes: async (status?: RentalStatus) => {
    const query = status ? `?status=${status}` : '';
    return request<RentalComplex[]>(`/rental/complexes${query}`);
  },

  getComplexById: async (id: string) => {
    return request<RentalComplex>(`/rental/complexes/${id}`);
  },

  createComplex: async (data: { complexName: string; location: string; status?: RentalStatus }) => {
    return request<RentalComplex>('/rental/complexes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateComplex: async (id: string, data: Partial<{ complexName: string; location: string; status: RentalStatus }>) => {
    return request<RentalComplex>(`/rental/complexes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getComplexDeleteCheck: async (id: string) => {
    return request<ComplexDeleteCheck>(`/rental/complexes/${id}/delete-check`);
  },

  deleteComplex: async (id: string) => {
    return request<{ success: boolean; message: string }>(`/rental/complexes/${id}`, {
      method: 'DELETE',
    });
  },

  // ── Shops ──────────────────────────────────────────────────────────────────
  getShops: async (params?: { complexId?: string; status?: RentalStatus; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.complexId) searchParams.append('complexId', params.complexId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<RentalShop[]>(`/rental/shops${query}`);
  },

  getShopById: async (id: string) => {
    return request<RentalShop>(`/rental/shops/${id}`);
  },

  getShopMonthlyStatus: async (id: string, month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<any>(`/rental/shops/${id}/status${query}`);
  },

  getShopSettlement: async (id: string) => {
    return request<ShopSettlementSummary>(`/rental/shops/${id}/settlement`);
  },

  getShopDeleteCheck: async (id: string) => {
    return request<ShopDeleteCheck>(`/rental/shops/${id}/delete-check`);
  },

  closeShop: async (id: string, data: {
    reason?: string;
    notes?: string;
    refundAmount?: number;
    refundPaymentMode?: PaymentMode | string;
    refundNotes?: string;
  }) => {
    return request<RentalShop>(`/rental/shops/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  refundSecurityDeposit: async (id: string, data: {
    refundAmount: number;
    paymentMode: PaymentMode | string;
    refundDate?: string;
    notes?: string;
  }) => {
    return request<{ shop: RentalShop; refundedAmount: number; remainingBalance: number }>(
      `/rental/shops/${id}/refund-deposit`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  deleteShop: async (id: string) => {
    return request<{ success: boolean; message: string }>(`/rental/shops/${id}`, {
      method: 'DELETE',
    });
  },

  createShop: async (data: {
    complexId: string;
    shopNumber: string;
    doorNumber: string;
    shopName: string;
    tenantName: string;
    mobileNumber: string;
    ebNumber?: string;
    monthlyRent: number;
    advanceAmount?: number;
    advancePaymentMode?: PaymentMode | string;
    status?: RentalStatus;
  }) => {
    return request<RentalShop>('/rental/shops', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateShop: async (
    id: string,
    data: Partial<{
      complexId: string;
      shopNumber: string;
      doorNumber: string;
      shopName: string;
      tenantName: string;
      mobileNumber: string;
      ebNumber: string;
      monthlyRent: number;
      advanceAmount: number;
      availableAdvance: number;
      status: RentalStatus;
    }>
  ) => {
    return request<RentalShop>(`/rental/shops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ── Rent Payments ──────────────────────────────────────────────────────────
  getPayments: async (params?: {
    complexId?: string;
    shopId?: string;
    paymentMonth?: string;
    paymentStatus?: string;
    paymentMode?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<RentalPayment[]>(`/rental/payments${query}`);
  },

  createPayment: async (data: {
    complexId: string;
    shopId: string;
    paymentMonth: string;
    amountReceived: number;
    paymentMode?: PaymentMode;
    cashAmount?: number;
    gpayAmount?: number;
    paymentDate?: string;
    mobileNumber?: string;
    notes?: string;
  }) => {
    return request<RentalPayment>('/rental/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ── Expenses ───────────────────────────────────────────────────────────────
  getExpenses: async (params?: {
    complexId?: string;
    shopId?: string;
    scope?: ExpenseScope;
    category?: ExpenseCategory;
    paymentMode?: PaymentMode;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<RentalExpense[]>(`/rental/expenses${query}`);
  },

  createExpense: async (data: {
    complexId?: string | null;
    expenseScope?: ExpenseScope;
    shopId?: string | null;
    expenseDate: string;
    category?: ExpenseCategory | string;
    expenseReason: string;
    expenseAmount: number;
    paymentMode: PaymentMode;
    cashAmount?: number;
    gpayAmount?: number;
    receiptUrl?: string;
    notes?: string;
  }) => {
    return request<RentalExpense>('/rental/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateExpense: async (
    id: string,
    data: Partial<{
      complexId?: string | null;
      expenseScope?: ExpenseScope;
      shopId?: string | null;
      expenseDate: string;
      category?: ExpenseCategory | string;
      expenseReason: string;
      expenseAmount: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      gpayAmount?: number;
      receiptUrl?: string;
      notes?: string;
    }>
  ) => {
    return request<RentalExpense>(`/rental/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteExpense: async (id: string) => {
    return request<{ success: boolean }>(`/rental/expenses/${id}`, {
      method: 'DELETE',
    });
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  getMonthlyReport: async (month?: string, complexId?: string) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (complexId) params.append('complexId', complexId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<MonthlyRentReportItem[]>(`/rental/reports/monthly${query}`);
  },

  getExpenseReport: async (params?: {
    complexId?: string;
    category?: ExpenseCategory;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<RentalExpense[]>(`/rental/reports/expenses${query}`);
  },

  getPaymentModeReport: async (month?: string, complexId?: string) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (complexId) params.append('complexId', complexId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<PaymentModeReportData>(`/rental/reports/payment-modes${query}`);
  },

  // ── Pending Rent ───────────────────────────────────────────────────────────
  getPendingRent: async (params?: {
    month?: string;
    complexId?: string;
    status?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.append('month', params.month);
    if (params?.complexId) searchParams.append('complexId', params.complexId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<PendingRentResponse>(`/rental/pending${query}`);
  },

  // ── Day Book ───────────────────────────────────────────────────────────────
  getDayBook: async (filter?: RentalDayBookFilter) => {
    const searchParams = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<RentalDayBookResponse>(`/rental/day-book${query}`);
  },

  createManualDayBookEntry: async (data: {
    date: string;
    transactionType: 'MANUAL_INCOME' | 'MANUAL_EXPENSE';
    particulars: string;
    amount: number;
    paymentMode: 'CASH' | 'GPAY' | 'BOTH';
    cashAmount?: number;
    gpayAmount?: number;
    complexId?: string;
    shopId?: string;
    category?: string;
    notes?: string;
  }) => {
    return request<RentalDayBookEntry>('/rental/day-book', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ── Admin Summary & Detail Endpoints (Finance Admin :5173 -> :8080) ────────
  getAdminSummary: async (month?: string, complexId?: string, search?: string) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (complexId) params.append('complexId', complexId);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<AdminRentalSummary>(`/admin/rental-summary${query}`);
  },

  getAdminComplexDetails: async (complexId: string, month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<any>(`/admin/rental/complexes/${complexId}${query}`);
  },

  getAdminShopDetails: async (shopId: string, month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<any>(`/admin/rental/shops/${shopId}${query}`);
  },

  getAdminPayments: async (params?: {
    month?: string;
    complexId?: string;
    shopId?: string;
    search?: string;
    status?: string;
    mode?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<any[]>(`/admin/rental/payments${query}`);
  },

  getAdminExpenses: async (params?: {
    month?: string;
    complexId?: string;
    shopId?: string;
    search?: string;
    category?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<any[]>(`/admin/rental/expenses${query}`);
  },

  getAdminSyncStatus: async () => {
    return request<any>('/admin/rental/sync-status');
  },

  resetRentalData: async () => {
    return request<any>('/admin/rental/reset-data', {
      method: 'POST',
    });
  },

  // ── Sync Control ───────────────────────────────────────────────────────────
  getSyncStatus: async () => {
    return request<SyncSummary>('/rental/sync/status');
  },

  retrySync: async () => {
    return request<{ processed: number; succeeded: number; failed: number }>('/rental/sync/retry', {
      method: 'POST',
    });
  },

  // ── Rental Notifications ──────────────────────────────────────────────────
  getRentalNotifications: async (readIds?: string[]) => {
    const query = readIds && readIds.length > 0 ? `?readIds=${encodeURIComponent(readIds.join(','))}` : '';
    return request<RentalNotification[]>(`/rental/notifications${query}`);
  },
};
