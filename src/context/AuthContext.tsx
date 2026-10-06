import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../types/server';

interface AuthContextType {
  currentUser: UserAccount | null;
  users: UserAccount[];
  hasAccounts: boolean;
  createOwnerAccount: (data: { username: string; displayName: string; password?: string }) => { success: boolean; error?: string };
  login: (username: string, password?: string) => { success: boolean; error?: string };
  logout: () => void;
  addUser: (data: { username: string; displayName: string; role: UserRole; allowedServerIds?: string[] }) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  deleteUser: (userId: string) => boolean;
  updateProfile: (data: { displayName?: string; avatarSeed?: string; customAvatarUrl?: string; password?: string }) => void;
  canPerformAction: (action: 'manage_servers' | 'server_power' | 'execute_commands' | 'manage_mods' | 'manage_backups' | 'manage_users' | 'edit_config') => boolean;
}

const DEFAULT_USERS: UserAccount[] = [];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('crafty_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('crafty_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem('crafty_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('crafty_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('crafty_current_user');
    }
  }, [currentUser]);

  const hasAccounts = users.length > 0;

  const createOwnerAccount = (data: { username: string; displayName: string; password?: string }) => {
    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, error: 'Username is required.' };
    }
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Username already exists.' };
    }

    const ownerUser: UserAccount = {
      id: `owner-${Date.now()}`,
      username: cleanUsername,
      displayName: data.displayName.trim() || cleanUsername,
      role: 'admin',
      avatarSeed: cleanUsername,
      password: data.password || '',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      allowedServerIds: [],
    };

    const newUsers = [ownerUser, ...users];
    setUsers(newUsers);
    setCurrentUser(ownerUser);
    localStorage.setItem('crafty_users', JSON.stringify(newUsers));
    localStorage.setItem('crafty_current_user', JSON.stringify(ownerUser));

    return { success: true };
  };

  const login = (username: string, password?: string) => {
    const found = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!found) {
      return { success: false, error: 'Invalid username or password.' };
    }
    if (found.password && password && found.password !== password) {
      return { success: false, error: 'Incorrect password.' };
    }
    const updated = { ...found, lastLogin: new Date().toISOString() };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const addUser = (data: {
    username: string;
    displayName: string;
    role: UserRole;
    allowedServerIds?: string[];
  }) => {
    const newUser: UserAccount = {
      id: `user-${Date.now()}`,
      username: data.username.trim().toLowerCase(),
      displayName: data.displayName.trim() || data.username,
      role: data.role,
      avatarSeed: data.username,
      createdAt: new Date().toISOString(),
      lastLogin: 'Never',
      allowedServerIds: data.allowedServerIds || [],
    };
    setUsers((prev) => [...prev, newUser]);
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, role } : null));
    }
  };

  const deleteUser = (userId: string) => {
    if (userId === currentUser?.id) return false;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    return true;
  };

  const updateProfile = (data: {
    displayName?: string;
    avatarSeed?: string;
    customAvatarUrl?: string;
    password?: string;
  }) => {
    if (!currentUser) return;
    const updated: UserAccount = {
      ...currentUser,
      displayName: data.displayName !== undefined ? data.displayName.trim() : currentUser.displayName,
      avatarSeed: data.avatarSeed !== undefined ? data.avatarSeed : currentUser.avatarSeed,
      customAvatarUrl: data.customAvatarUrl !== undefined ? data.customAvatarUrl : currentUser.customAvatarUrl,
      password: data.password !== undefined ? data.password : currentUser.password,
    };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const canPerformAction = (
    action: 'manage_servers' | 'server_power' | 'execute_commands' | 'manage_mods' | 'manage_backups' | 'manage_users' | 'edit_config'
  ): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

    if (currentUser.role === 'operator') {
      return (
        action === 'server_power' ||
        action === 'execute_commands' ||
        action === 'manage_mods' ||
        action === 'manage_backups'
      );
    }

    if (currentUser.role === 'viewer') {
      return false; // read-only
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        hasAccounts,
        createOwnerAccount,
        login,
        logout,
        addUser,
        updateUserRole,
        deleteUser,
        updateProfile,
        canPerformAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
