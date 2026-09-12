import axios, { AxiosInstance } from 'axios';

// Supports Centralized MongoDB Atlas + Local Storage Vault + Custom JWT Auth & RBAC

let customApiBaseUrl: string | null = null;

export const getApiBaseUrl = (): string => {
  if (customApiBaseUrl) return customApiBaseUrl;

  const envValue = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  const raw = (
    envValue ||
    (typeof window !== 'undefined' && (window as any).__FINANCE_API_URL__) ||
    'http://localhost:8080/api'
  ).trim();
  const clean = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

export const setApiBaseUrl = (url: string) => {
  customApiBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
};

// Log configured API Base once on initialization
if (typeof window !== 'undefined' && !(window as any).__KKV_API_LOGGED__) {
  (window as any).__KKV_API_LOGGED__ = true;
  console.log(`[API] Base URL: ${getApiBaseUrl()}`);
}

function generateIdempotencyKey(): string {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    sessionStorage.getItem('kkv_auth_token') ||
    localStorage.getItem('kkv_auth_token') ||
    sessionStorage.getItem('kkv_session_token') ||
    localStorage.getItem('kkv_session_token') ||
    null
  );
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    sessionStorage.setItem('kkv_auth_token', token);
    localStorage.setItem('kkv_auth_token', token);
  } else {
    sessionStorage.removeItem('kkv_auth_token');
    localStorage.removeItem('kkv_auth_token');
    sessionStorage.removeItem('kkv_session_token');
    localStorage.removeItem('kkv_session_token');
  }
}

// ── Centralized Axios Client ────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for dynamic baseUrl, auth token & idempotency key
api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = getStoredAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.method && config.method.toUpperCase() !== 'GET' && config.method.toUpperCase() !== 'HEAD') {
    if (config.headers) {
      config.headers['x-idempotency-key'] = generateIdempotencyKey();
    }
  }
  return config;
});

// Response interceptor with user-friendly backend connection error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[API Auth] 401 Unauthorized received. Session expired.');
      setStoredAuthToken(null);
    }
    if (!error.response) {
      console.warn('[API Error] Unable to connect to KKV Gold Finance backend. Make sure the backend is running on port 8080.');
    }
    return Promise.reject(error);
  }
);

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  const baseUrl = getApiBaseUrl();
  const token = getStoredAuthToken();
  const method = (options?.method || 'GET').toUpperCase();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(method !== 'GET' && method !== 'HEAD' ? { 'x-idempotency-key': generateIdempotencyKey() } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (res.status === 401) {
      console.warn(`[Auth 401] Unauthorized on ${endpoint}`);
      setStoredAuthToken(null);
      return null;
    }

    if (res.status === 403) {
      console.warn(`[Auth 403] Access Denied on ${endpoint}`);
      const errorJson = await res.json().catch(() => null);
      throw new Error(errorJson?.message || 'Access Denied: You do not have permission for this action.');
    }

    if (res.status === 409) {
      console.warn(`[Concurrency Conflict] Record modified concurrently on ${endpoint}.`);
      const errorJson = await res.json().catch(() => null);
      throw new Error(errorJson?.message || 'Conflict: Record was modified by another staff member. Please refresh and retry.');
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      if (errorJson?.message) {
        console.warn(`[Backend API] Request failed with ${res.status}: ${errorJson.message}`);
      }
      return null;
    }
    const json = await res.json();
    return json.data ?? json;
  } catch (err: any) {
    if (err.message && (err.message.includes('Conflict:') || err.message.includes('Access Denied'))) {
      throw err;
    }
    console.warn(`[API Error] Unable to connect to backend at ${baseUrl}${endpoint}.`);
    return null;
  }
}

export const apiService = {
  // ── Authentication & Identity ──────────────────────────────────────────────
  async login(credentials: { email?: string; username?: string; password?: string }) {
    let res: Response;
    try {
      res = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
    } catch (networkErr: any) {
      // Network-level failure (backend down, CORS blocked at network layer, etc.)
      throw new Error('Unable to connect to the server. Please check that the backend is running and try again.');
    }

    let json: any = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }

    if (res.ok && json.success) {
      if (json.token) {
        setStoredAuthToken(json.token);
      }
      return json;
    }

    // Map specific HTTP status codes to user-friendly messages
    switch (res.status) {
      case 400:
        throw new Error(json.message || 'Invalid login request. Please enter your email/staff ID and password.');
      case 401:
        throw new Error(json.message || 'Invalid email/staff ID or password. Please try again.');
      case 403:
        throw new Error(json.message || 'Access denied. Your account may be deactivated. Please contact an administrator.');
      case 422:
        throw new Error(json.message || 'Invalid login request. Please check your input and try again.');
      case 503:
        throw new Error(json.message || 'Database service is temporarily unavailable. Please try again shortly.');
      case 500:
        throw new Error(json.message || 'Server error. Please try again in a moment.');
      default:
        throw new Error(json.message || `Login failed (${res.status}). Please try again.`);
    }
  },

  async getMe() {
    const token = getStoredAuthToken();
    if (!token) return null;
    const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      if (res.status === 401) {
        setStoredAuthToken(null);
      }
      return null;
    }
    const json = await res.json();
    return json.user || json.data || json;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const token = getStoredAuthToken();
    const res = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to change password');
    }
    return json;
  },

  async logout() {
    const token = getStoredAuthToken();
    try {
      if (token) {
        await fetch(`${getApiBaseUrl()}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
      }
    } finally {
      setStoredAuthToken(null);
    }
    return { success: true };
  },

  // ── Health & Global Search ─────────────────────────────────────────────────
  async getHealth() {
    return fetchJson<{ application: string; storage: string }>('/health');
  },
  async globalSearch(query: string) {
    if (!query || !query.trim()) {
      return { customers: [], loans: [], receipts: [] };
    }
    return fetchJson<{ customers: any[]; loans: any[]; receipts: any[] }>(`/search?q=${encodeURIComponent(query)}`);
  },
  async resolveLocationLink(url: string) {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/location/resolve-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ url })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || 'Failed to resolve location link');
      }
      const json = await res.json();
      return json.data;
    } catch (err: any) {
      throw new Error(err.message || 'Location link resolution failed');
    }
  },

  // ── Customers ──────────────────────────────────────────────────────────────
  async getCustomers(includeDeleted: boolean = false) {
    return fetchJson<any[]>(`/customers${includeDeleted ? '?includeDeleted=true' : ''}`);
  },
  async getCustomerById(id: string) {
    return fetchJson<any>(`/customers/${encodeURIComponent(id)}`);
  },
  async searchCustomers(query: string) {
    if (!query || !query.trim()) {
      return this.getCustomers();
    }
    return fetchJson<any[]>(`/customers/search?query=${encodeURIComponent(query)}`);
  },
  async createCustomer(customer: any) {
    return fetchJson<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  },
  async createCustomerFormData(formData: FormData) {
    const baseUrl = getApiBaseUrl();
    const token = getStoredAuthToken();
    try {
      const res = await axios.post(`${baseUrl}/customers`, formData, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-idempotency-key': generateIdempotencyKey()
        }
      });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Customer creation failed';
      throw new Error(msg);
    }
  },
  async updateCustomer(id: string, customer: any) {
    return fetchJson<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    });
  },
  async updateCustomerFormData(id: string, formData: FormData) {
    const baseUrl = getApiBaseUrl();
    const token = getStoredAuthToken();
    try {
      const res = await axios.put(`${baseUrl}/customers/${id}`, formData, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-idempotency-key': generateIdempotencyKey()
        }
      });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Customer update failed';
      throw new Error(msg);
    }
  },
  async deleteCustomer(id: string) {
    return fetchJson<{ success: boolean; message: string }>(`/customers/${id}`, {
      method: 'DELETE'
    });
  },
  async restoreCustomer(id: string) {
    return fetchJson<{ success: boolean; message: string }>(`/customers/${id}/restore`, {
      method: 'POST'
    });
  },
  async deleteCustomerPermanently(id: string) {
    return fetchJson<{ success: boolean; message: string }>(`/customers/${id}/permanent`, {
      method: 'DELETE'
    });
  },

  // ── Loans ──────────────────────────────────────────────────────────────────
  async getLoans() {
    return fetchJson<any[]>('/loans');
  },
  async createLoan(loan: any) {
    return fetchJson<any>('/loans', {
      method: 'POST',
      body: JSON.stringify(loan),
    });
  },
  async closeLoan(loanNo: string) {
    return fetchJson<any>(`/loans/${loanNo}/close`, {
      method: 'POST',
    });
  },

  // ── Receipts ───────────────────────────────────────────────────────────────
  async getReceipts() {
    return fetchJson<any[]>('/receipts');
  },
  async createReceipt(receipt: any) {
    return fetchJson<any>('/receipts', {
      method: 'POST',
      body: JSON.stringify(receipt),
    });
  },

  // ── Fixed Deposits ─────────────────────────────────────────────────────────
  async getFDCustomers() {
    return fetchJson<any[]>('/fd/customers');
  },
  async createFDCustomer(customer: any) {
    return fetchJson<any>('/fd/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  },
  async getFixedDeposits() {
    return fetchJson<any[]>('/fd/deposits');
  },
  async createFixedDeposit(fd: any) {
    return fetchJson<any>('/fd/deposits', {
      method: 'POST',
      body: JSON.stringify(fd),
    });
  },
  async payFDInterest(fdNo: string, amount: number, mode: string) {
    return fetchJson<any>(`/fd/deposits/${fdNo}/payout`, {
      method: 'POST',
      body: JSON.stringify({ amount, mode })
    });
  },
  async withdrawFD(fdNo: string, mode: string, notes?: string) {
    return fetchJson<any>(`/fd/deposits/${fdNo}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ mode, notes })
    });
  },
  async getFDConfig() {
    return fetchJson<any>('/fd/config');
  },
  async updateFDConfig(config: any) {
    return fetchJson<any>('/fd/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },
  async bulkUpdateFDDates(fdNos: string[], newDepositDate?: string, offsetDays?: number) {
    return fetchJson<any>('/fd/deposits/bulk-date-change', {
      method: 'POST',
      body: JSON.stringify({ fdNos, newDepositDate, offsetDays })
    });
  },

  // ── Accounting / Day Book ──────────────────────────────────────────────────
  async getDayBook() {
    return fetchJson<any[]>('/accounting/day-book');
  },
  async createVoucher(entry: any) {
    return fetchJson<any>('/accounting/vouchers', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },
  async getBalances() {
    return fetchJson<{ cashInHand: number; cashAtBank: number }>('/accounting/balances');
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  async getDashboardSummary(branchId?: string) {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return fetchJson<{ success: boolean; data: import('../types').DashboardSummaryData }>(`/dashboard/summary${query}`);
  },

  // ── Admin & Settings ───────────────────────────────────────────────────────
  async getMasterSettings() {
    return fetchJson<any>('/admin/settings');
  },
  // Read-only settings accessible to ADMIN + STAFF + RENTAL_STAFF.
  // Returns loan types, FD config, repayment systems — no passwords.
  // Call this on every page load for ALL roles to ensure fresh config.
  async getPublicSettings() {
    return fetchJson<any>('/config/settings');
  },
  async updateMasterSettings(settings: any) {
    return fetchJson<any>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },
  async getWhatsAppTemplates() {
    return fetchJson<any>('/admin/whatsapp-templates');
  },
  async updateWhatsAppTemplates(templates: any) {
    return fetchJson<any>('/admin/whatsapp-templates', {
      method: 'PUT',
      body: JSON.stringify(templates)
    });
  },
  async unlockMasterControl(password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ password })
      });
      const json = await res.json().catch(() => ({}));
      return { success: res.ok && json.success, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to communicate with backend.' };
    }
  },
  async changeMasterPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/change-master-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const json = await res.json().catch(() => ({}));
      return { success: res.ok && json.success, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update Master Control password.' };
    }
  },

  // ── Backup & Restore ───────────────────────────────────────────────────────
  async createCloudBackup(backupData?: any, deviceId?: string) {
    return fetchJson<any>('/backup/create', {
      method: 'POST',
      body: JSON.stringify({ backupData, deviceId })
    });
  },
  async exportBackup() {
    return fetchJson<any>('/backup/export');
  },
  async restoreBackup(data: any) {
    return fetchJson<any>('/backup/restore', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async backupAndClose(user?: { userId?: string; name?: string; role?: string }) {
    return fetchJson<any>('/backup/close', {
      method: 'POST',
      body: JSON.stringify(user || {})
    });
  },
  async checkAutoRestore() {
    return fetchJson<any>('/backup/auto-restore-check');
  },
  async getSyncStatus() {
    return fetchJson<any>('/sync/status');
  },
  async retrySyncQueue() {
    return fetchJson<any>('/sync/retry', {
      method: 'POST'
    });
  },
  async getSyncEvents() {
    return fetchJson<any>('/sync/events');
  },

  // ── Telegram Integration ───────────────────────────────────────────────────
  async getTelegramConfig() {
    return fetchJson<any>('/telegram/config');
  },
  async updateTelegramConfig(config: any) {
    return fetchJson<any>('/telegram/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },
  async testTelegram() {
    return fetchJson<any>('/telegram/test', {
      method: 'POST'
    });
  },
  async backupTelegram() {
    return fetchJson<any>('/telegram/backup', {
      method: 'POST'
    });
  },

  // ── Production Backup Package Management ───────────────────────────────────
  async createBackupPackage(): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error during backup creation.' };
    }
  },

  async getBackupHistory(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/backup/history`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data || []
      };
    } catch (err: any) {
      return { success: false, data: [], message: err?.message || 'Failed to load backup history.' };
    }
  },

  getBackupDownloadUrl(backupId: string): string {
    return `${getApiBaseUrl()}/admin/backup/${encodeURIComponent(backupId)}/download`;
  },

  async acknowledgeBackupDownload(backupId: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/backup/${encodeURIComponent(backupId)}/acknowledge-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to acknowledge download.' };
    }
  },

  // ── Wipe All Data ──────────────────────────────────────────────────────────
  async getWipePreview(): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/wipe-all-data/preview`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to fetch wipe preview.' };
    }
  },

  async initiateWipeBackup(confirmationText: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/wipe-all-data/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ confirmationText })
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error during backup initiation.' };
    }
  },

  async confirmSystemWipe(token: string, confirmationText: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/wipe-all-data/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ token, confirmationText })
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error during system wipe.' };
    }
  },

  async getRestoreBackups(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/system/backups`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data || [],
        message: json.message
      };
    } catch (err: any) {
      return { success: false, data: [], message: err?.message || 'Failed to fetch backups.' };
    }
  },

  async getAvailableBackups(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    return this.getRestoreBackups();
  },

  async validateRestoreBackup(payload: {
    fileId?: string;
    backupId?: string;
    file?: File;
    jsonString?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const token = getStoredAuthToken();
      let res: Response;
      if (payload.file) {
        const formData = new FormData();
        formData.append('backupFile', payload.file);
        res = await fetch(`${getApiBaseUrl()}/admin/system/restore/validate`, {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: formData
        });
      } else {
        res = await fetch(`${getApiBaseUrl()}/admin/system/restore/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            fileId: payload.fileId,
            backupId: payload.backupId,
            jsonString: payload.jsonString
          })
        });
      }
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error during backup validation.' };
    }
  },

  async executeSystemRestore(token: string, confirmationText: string): Promise<{ success: boolean; data?: any; message?: string; restore?: any; recordCounts?: any }> {
    try {
      const authToken = getStoredAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/admin/system/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ token, confirmationText })
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        data: json.data,
        message: json.message,
        restore: json.restore,
        recordCounts: json.recordCounts
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error during restore execution.' };
    }
  },

  async getRestoreHistory(): Promise<{ success: boolean; data: any[]; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/system/restore/history`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data || [] };
    } catch (err: any) {
      return { success: false, data: [], message: err?.message || 'Failed to load restore history.' };
    }
  },

  // ── Device & Session Management ────────────────────────────────────────────
  async getSessions(): Promise<{ success: boolean; data: any[]; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/sessions`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data || [] };
    } catch (err: any) {
      return { success: false, data: [], message: err?.message || 'Failed to load sessions.' };
    }
  },

  async registerSession(sessionData: any): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/sessions/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify(sessionData)
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to register session.' };
    }
  },

  async revokeSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to revoke session.' };
    }
  },

  async revokeOtherSessions(currentSessionId: string): Promise<{ success: boolean; revokedCount?: number; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/sessions/revoke-others`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ currentSessionId })
      });
      const json = await res.json();
      return { success: res.ok && json.success, revokedCount: json.revokedCount, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to revoke other sessions.' };
    }
  },

  async revokeAllSessions(): Promise<{ success: boolean; revokedCount?: number; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/sessions/revoke-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, revokedCount: json.revokedCount, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to revoke all sessions.' };
    }
  },

  async checkSessionStatus(sessionId: string): Promise<{ success: boolean; data?: { isValid: boolean; isRevoked?: boolean; session?: any }; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/sessions/check/${sessionId}`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to check session.' };
    }
  },

  // ── Staff Management (ADMIN Only) ──────────────────────────────────────────
  async getStaffList(): Promise<{ success: boolean; data: any[]; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/staff`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data || [] };
    } catch (err: any) {
      return { success: false, data: [], message: err?.message || 'Failed to load staff directory.' };
    }
  },

  async createStaff(staffData: any): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify(staffData)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to create staff account.');
      }
      return { success: true, data: json.data, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to create staff account.' };
    }
  },

  async updateStaff(id: string, updates: any): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/staff/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update staff profile.' };
    }
  },

  async toggleStaffStatus(id: string, isActive: boolean): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/staff/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ isActive })
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to change staff status.' };
    }
  },

  async resetStaffPassword(id: string, newPassword?: string): Promise<{ success: boolean; temporaryPassword?: string; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/staff/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        },
        body: JSON.stringify({ newPassword })
      });
      const json = await res.json();
      return { success: res.ok && json.success, temporaryPassword: json.temporaryPassword, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to reset staff password.' };
    }
  },

  async deleteStaff(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/staff/${id}`, {
        method: 'DELETE',
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, message: json.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete staff account.' };
    }
  },

  async getStaffAuditLogs(): Promise<{ success: boolean; data: any[]; message?: string }> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/audit-logs`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data || [] };
    } catch (err: any) {
      return { success: false, data: [], message: err?.message || 'Failed to fetch audit logs' };
    }
  },

  downloadBackup(backupId: string) {
    const token = getStoredAuthToken();
    const url = `${getApiBaseUrl()}/backups/${backupId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    window.open(url, '_blank');
  },

  async getNextLoanSequence(): Promise<{ nextSequence: number; loanNo: string; receiptNo: number } | null> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/loans/next-sequence`, {
        headers: {
          ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {})
        }
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        return json.data;
      }
      return null;
    } catch (err) {
      console.warn('[apiService] getNextLoanSequence fallback:', err);
      return null;
    }
  },

  async restoreLatestBackup(): Promise<{ success: boolean; data?: any; message?: string }> {
    return this.restoreBackup(true);
  },

  async uploadFile(
    file: File | Blob,
    options: {
      entityType: string;
      entityId?: string;
      documentType?: string;
      fileName?: string;
      onProgress?: (percent: number) => void;
    }
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file, options.fileName || (file as File).name || 'upload_file');
      formData.append('entityType', options.entityType);
      if (options.entityId) formData.append('entityId', options.entityId);
      if (options.documentType) formData.append('documentType', options.documentType);

      const res = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && options.onProgress) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            options.onProgress(percent);
          }
        }
      });

      return {
        success: true,
        data: res.data?.data || res.data,
        message: res.data?.message || 'File uploaded successfully'
      };
    } catch (err: any) {
      console.error('[apiService] uploadFile error:', err);
      const msg = err.response?.data?.message || err.message || 'File upload failed';
      return { success: false, message: msg };
    }
  },

  getFileViewUrl(fileIdOrPath: string): string {
    if (!fileIdOrPath) return '';
    if (fileIdOrPath.startsWith('http://') || fileIdOrPath.startsWith('https://') || fileIdOrPath.startsWith('data:')) {
      return fileIdOrPath;
    }
    const clean = fileIdOrPath.startsWith('/') ? fileIdOrPath : `/files/${fileIdOrPath}/view`;
    return `${getApiBaseUrl()}${clean.startsWith('/api') ? clean.replace(/^\/api/, '') : clean}`;
  },

  async deleteFile(fileId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await api.delete(`/files/${fileId}`);
      return { success: true, message: res.data?.message || 'File deleted' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message || 'Failed to delete file' };
    }
  }
};

export default apiService;
