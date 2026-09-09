import { DeviceSession } from '../types/index.js';

class SessionService {
  private sessions: DeviceSession[] = [
    {
      sessionId: 'sess_master_current',
      userId: 'kkv_admin',
      userRole: 'MASTER_ADMIN',
      userEmail: 'goldfinancekkv@gmail.com',
      deviceType: 'DESKTOP',
      deviceName: 'Windows PC',
      operatingSystem: 'Windows 11',
      osVersion: '11',
      browser: 'Chrome 139',
      browserVersion: '139.0.0.0',
      ipAddress: '192.168.1.102',
      location: 'Salem, Tamil Nadu, India',
      screenResolution: '1920 × 1080',
      timezone: 'Asia/Kolkata',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      lastActiveAt: new Date().toISOString(),
      status: 'ACTIVE'
    },
    {
      sessionId: 'sess_android_branch',
      userId: 'kkv_admin',
      userRole: 'MASTER_ADMIN',
      userEmail: 'goldfinancekkv@gmail.com',
      deviceType: 'MOBILE',
      deviceName: 'Android Phone',
      operatingSystem: 'Android 15',
      osVersion: '15',
      browser: 'Chrome 138',
      browserVersion: '138.0.0.0',
      ipAddress: '192.168.1.145',
      location: 'Salem, Tamil Nadu, India',
      screenResolution: '412 × 915',
      timezone: 'Asia/Kolkata',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      lastActiveAt: new Date(Date.now() - 60000 * 15).toISOString(), // 15 mins ago
      status: 'ACTIVE'
    },
    {
      sessionId: 'sess_laptop_backup',
      userId: 'kkv_admin',
      userRole: 'MASTER_ADMIN',
      userEmail: 'goldfinancekkv@gmail.com',
      deviceType: 'LAPTOP',
      deviceName: 'Branch Laptop',
      operatingSystem: 'Windows 11',
      osVersion: '11',
      browser: 'Edge 128',
      browserVersion: '128.0.0.0',
      ipAddress: '192.168.1.110',
      location: 'Salem, Tamil Nadu, India',
      screenResolution: '1536 × 864',
      timezone: 'Asia/Kolkata',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      lastActiveAt: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago
      status: 'INACTIVE'
    }
  ];

  public listSessions(): DeviceSession[] {
    const now = Date.now();
    // Auto-mark stale active sessions (>2 hours without heartbeat) as INACTIVE
    this.sessions = this.sessions.map((s) => {
      if (s.status === 'ACTIVE') {
        const lastMs = new Date(s.lastActiveAt).getTime();
        if (now - lastMs > 3600000 * 2) {
          return { ...s, status: 'INACTIVE' };
        }
      }
      return s;
    });

    return [...this.sessions].sort((a, b) => {
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
  }

  public registerSession(sessionData: Partial<DeviceSession> & { sessionId: string }): DeviceSession {
    const existingIndex = this.sessions.findIndex((s) => s.sessionId === sessionData.sessionId);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = this.sessions[existingIndex];
      // If already revoked, do not silently resurrect unless new login
      const status = existing.status === 'REVOKED' && sessionData.status !== 'ACTIVE' ? 'REVOKED' : (sessionData.status || 'ACTIVE');

      const updated: DeviceSession = {
        ...existing,
        ...sessionData,
        lastActiveAt: now,
        status
      };
      this.sessions[existingIndex] = updated;
      return updated;
    }

    const newSession: DeviceSession = {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId || 'kkv_admin',
      userRole: sessionData.userRole || 'MASTER_ADMIN',
      userEmail: sessionData.userEmail || 'goldfinancekkv@gmail.com',
      deviceType: sessionData.deviceType || 'DESKTOP',
      deviceName: sessionData.deviceName || 'Windows PC',
      operatingSystem: sessionData.operatingSystem || 'Windows',
      osVersion: sessionData.osVersion,
      browser: sessionData.browser || 'Chrome',
      browserVersion: sessionData.browserVersion,
      ipAddress: sessionData.ipAddress || '192.168.1.102',
      location: sessionData.location || 'Salem, Tamil Nadu, India',
      screenResolution: sessionData.screenResolution,
      timezone: sessionData.timezone || 'Asia/Kolkata',
      createdAt: sessionData.createdAt || now,
      lastActiveAt: now,
      status: 'ACTIVE'
    };

    this.sessions.unshift(newSession);
    return newSession;
  }

  public revokeSession(sessionId: string): boolean {
    const target = this.sessions.find((s) => s.sessionId === sessionId);
    if (!target) return false;
    target.status = 'REVOKED';
    target.lastActiveAt = new Date().toISOString();
    return true;
  }

  public revokeOtherSessions(keepSessionId: string): number {
    let count = 0;
    this.sessions = this.sessions.map((s) => {
      if (s.sessionId !== keepSessionId && (s.status === 'ACTIVE' || s.status === 'INACTIVE')) {
        count++;
        return { ...s, status: 'REVOKED', lastActiveAt: new Date().toISOString() };
      }
      return s;
    });
    return count;
  }

  public revokeAllSessions(): number {
    let count = 0;
    this.sessions = this.sessions.map((s) => {
      if (s.status === 'ACTIVE' || s.status === 'INACTIVE') {
        count++;
        return { ...s, status: 'REVOKED', lastActiveAt: new Date().toISOString() };
      }
      return s;
    });
    return count;
  }

  public revokeStaffSessions(userIdOrEmail: string): number {
    let count = 0;
    const target = (userIdOrEmail || '').toLowerCase().trim();
    this.sessions = this.sessions.map((s) => {
      if (
        (s.userId?.toLowerCase() === target || s.userEmail?.toLowerCase() === target) &&
        (s.status === 'ACTIVE' || s.status === 'INACTIVE')
      ) {
        count++;
        return { ...s, status: 'REVOKED', lastActiveAt: new Date().toISOString() };
      }
      return s;
    });
    return count;
  }

  public checkSession(sessionId: string): { isValid: boolean; isRevoked?: boolean; session?: DeviceSession } {
    const found = this.sessions.find((s) => s.sessionId === sessionId);
    if (found && (found.status === 'REVOKED' || found.status === 'EXPIRED')) {
      return { isValid: false, isRevoked: true, session: found };
    }
    return { isValid: true, isRevoked: false, session: found };
  }
}

export const sessionService = new SessionService();
