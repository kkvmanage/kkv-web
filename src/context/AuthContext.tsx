import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, getStoredAuthToken } from '../services/api';
import { UserProfile, UserRole } from '../types';
import { normalizeRole, getDefaultPermissionsForRole } from '../config/permissions';
import { useApp } from './AppContext';

export interface AuthContextType {
  user: UserProfile | null;
  currentUser: UserProfile | null;
  role: UserRole;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: any }>;
  logout: () => Promise<void>;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('STAFF');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiService.getMe()
      .then((res: any) => {
        const u = res?.user || res?.data || (res?.role ? res : null);
        if (u && u.role) {
          const userRole = normalizeRole(u.role);
          const profile: UserProfile = {
            uid: u.id || u._id || u.staffId || u.uid || 'user_uid',
            email: u.email,
            displayName: u.name || u.fullName || u.email,
            role: userRole,
            isActive: u.isActive !== false,
            mustChangePassword: !!u.mustChangePassword,
            permissions: u.permissions || getDefaultPermissionsForRole(userRole),
            createdAt: u.createdAt || new Date().toISOString(),
            updatedAt: u.updatedAt || new Date().toISOString()
          };
          setUser(profile);
          setRole(profile.role);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res: any = await apiService.login({ email, password });
      const u = res?.user || res?.data?.user || res?.data;
      if (res && res.success && u) {
        const userRole = normalizeRole(u.role);
        const profile: UserProfile = {
          uid: u.id || u._id || u.staffId || u.uid || 'user_uid',
          email: u.email,
          displayName: u.name || u.fullName || u.email,
          role: userRole,
          isActive: u.isActive !== false,
          mustChangePassword: !!u.mustChangePassword,
          permissions: u.permissions || getDefaultPermissionsForRole(userRole),
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString()
        };
        setUser(profile);
        setRole(profile.role);
        return { success: true, user: profile };
      }
      return { success: false, message: res?.message || 'Login failed' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error during login' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await apiService.logout();
    setUser(null);
    setRole('STAFF');
  };

  const changePassword = async (payload: { currentPassword: string; newPassword: string }) => {
    return apiService.changePassword(payload);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        role,
        loading,
        login,
        logout,
        changePassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context) return context;
  try {
    // Graceful fallback to AppContext for unified authentication
    const app = useApp();
    return {
      user: app.currentUser,
      currentUser: app.currentUser,
      role: app.userRole || 'STAFF',
      loading: app.authLoading,
      login: async (email: string, password: string) => {
        const res = await app.loginWithCredentials(email, password);
        return { success: res.success, message: res.message, user: app.currentUser };
      },
      logout: async () => {
        await app.logoutUser();
      },
      changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
        return apiService.changePassword(payload);
      }
    };
  } catch {
    throw new Error('useAuth must be used within an AuthProvider or AppProvider');
  }
};

export default AuthContext;
