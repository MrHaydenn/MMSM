import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../types/server';

interface AuthContextType {
  currentUser: UserAccount | null;
  users: UserAccount[];
  login: (username: string, password?: string) => { success: boolean; error?: string };
  logout: () => void;
  addUser: (data: { username: string; displayName: string; role: UserRole; allowedServerIds?: string[] }) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  deleteUser: (userId: string) => boolean;
  updateProfile: (data: { displayName?: string; avatarSeed?: string; customAvatarUrl?: string; password?: string }) => void;
  canPerformAction: (action: 'manage_servers' | 'server_power' | 'execute_commands' | 'manage_mods' | 'manage_backups' | 'manage_users' | 'edit_config') => boolean;
}

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-admin',
    username: 'admin',
    displayName: 'SysAdmin Alex',
    role: 'admin',
    avatarSeed: 'Alex',
    password: 'crafty123',
    createdAt: '2024-01-10T08:00:00Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'user-operator',
    username: 'notch_op',
    displayName: 'Notch (Operator)',
    role: 'operator',
    avatarSeed: 'Notch',
    password: 'operator123',
    createdAt: '2024-03-15T12:30:00Z',
    lastLogin: '2024-12-28T14:20:00Z',
  },
  {
    id: 'user-viewer',
    username: 'spectator',
    displayName: 'Guest Spectator',
    role: 'viewer',
    avatarSeed: 'Steve',
    password: 'viewer123',
    createdAt: '2024-05-01T10:00:00Z',
    lastLogin: '2024-12-20T09:15:00Z',
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('crafty_users');
    if (saved) {
      try {
        return JSON.parse(saved);
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
    // Default to admin for seamless experience, or null if logged out
    return DEFAULT_USERS[0];
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

  const login = (username: string, _password?: string) => {
    const found = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!found) {
      return { success: false, error: 'User does not exist. Check credentials or use quick login.' };
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
