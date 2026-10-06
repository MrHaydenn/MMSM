import React, { useState } from 'react';
import {
  UserCheck,
  Shield,
  Plus,
  Trash2,
  Lock,
  User as UserIcon,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useServer } from '../../context/ServerContext';
import { UserRole } from '../../types/server';

export const UserManagementView: React.FC = () => {
  const { users, currentUser, addUser, updateUserRole, deleteUser } = useAuth();
  const { servers } = useServer();

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    addUser({
      username: newUsername.trim(),
      displayName: newDisplayName.trim() || newUsername.trim(),
      role: newRole,
    });

    setNewUsername('');
    setNewDisplayName('');
    setNewRole('operator');
    setIsAddUserOpen(false);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-950/70 border-purple-800/60 text-purple-300';
      case 'operator':
        return 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300';
      case 'viewer':
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-400';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>User Management & Access Control</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Grant role-based permissions (Admin, Operator, Viewer) to team members and server operators
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Permissions Matrix Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#11151c] border border-purple-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase font-mono">
            <Shield className="w-4 h-4" />
            <span>Administrator (Admin)</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Unrestricted access: Create/delete servers, manage users, modify global configs, full console terminal, and backup restorations.
          </p>
        </div>

        <div className="bg-[#11151c] border border-emerald-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase font-mono">
            <Shield className="w-4 h-4" />
            <span>Operator (OP)</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Operational duties: Start/stop/restart servers, execute Minecraft commands, kick/ban players, install and toggle mods from Modrinth.
          </p>
        </div>

        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs uppercase font-mono">
            <Shield className="w-4 h-4" />
            <span>Spectator / Viewer</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Read-only access: View live console output, telemetry graphs, and online players. Cannot issue commands or stop servers.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Configured Accounts ({users.length})</h3>
        </div>

        <div className="divide-y divide-zinc-800/80">
          {users.map((user) => (
            <div
              key={user.id}
              className="p-4 hover:bg-zinc-900/30 transition-colors flex flex-wrap items-center justify-between gap-4 text-xs"
            >
              {/* User info */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-emerald-400 text-sm uppercase">
                  {user.username.charAt(0)}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100 text-sm">{user.displayName}</span>
                    <span className="text-zinc-500 font-mono">@{user.username}</span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-semibold ${getRoleBadge(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Created {new Date(user.createdAt).toLocaleDateString()} · Last login: {user.lastLogin}
                  </p>
                </div>
              </div>

              {/* Role selector & Delete */}
              <div className="flex items-center gap-3">
                <select
                  value={user.role}
                  onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>

                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ADD USER MODAL */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="bg-[#11151c] border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-100 text-base">Create New WebGUI User</h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-300">Username (Login Handle)</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. josh_admin"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-300">Display Name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. Josh Mitchell (Lead Admin)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-300">Role / Access Level</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              >
                <option value="operator">Operator (Server controls & console commands)</option>
                <option value="admin">Administrator (Complete server & fleet rights)</option>
                <option value="viewer">Viewer (Read-only observation)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40"
              >
                Save User
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
