import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Shield,
  ArrowRight,
  AlertCircle,
  Sparkles,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MmsmLogo } from '../common/MmsmLogo';

export const LoginPage: React.FC = () => {
  const { login, createOwnerAccount, hasAccounts, users } = useAuth();
  const isFirstTimeSetup = !hasAccounts || users.length === 0;

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Initial setup state
  const [setupUsername, setSetupUsername] = useState('admin');
  const [setupDisplayName, setSetupDisplayName] = useState('Server Owner');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = login(username, password);
    if (!result.success) {
      setError(result.error || 'Authentication failed');
    }
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!setupUsername.trim()) {
      setError('Please choose a username.');
      return;
    }

    if (setupPassword && setupPassword !== setupConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const result = createOwnerAccount({
      username: setupUsername,
      displayName: setupDisplayName,
      password: setupPassword,
    });

    if (!result.success) {
      setError(result.error || 'Failed to create owner account.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090c10] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none font-sans">
      {/* Background ambient gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="mx-auto flex justify-center">
            <MmsmLogo size={56} />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight font-mono">
              MMSM
            </h1>
            <p className="text-xs text-zinc-400">
              MrHaydenn's Minecraft Server Manager Wrapper
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
          {isFirstTimeSetup ? (
            // INITIAL FIRST-TIME SETUP: CREATE OWNER ACCOUNT
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Shield className="w-4 h-4" />
                  <span>Initial Setup: Create Primary Owner Account</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  This first account receives root Owner / Admin privileges. Once created, public registration is locked and only existing accounts can log in.
                </p>
              </div>

              <form onSubmit={handleSetupSubmit} className="space-y-3.5">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Owner Username</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      placeholder="e.g. admin or yourname"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Display Name</label>
                  <input
                    type="text"
                    value={setupDisplayName}
                    onChange={(e) => setSetupDisplayName(e.target.value)}
                    placeholder="e.g. Server Owner"
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Master Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="Create master password"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Confirm Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="Confirm master password"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Owner Account & Launch MMSM</span>
                </button>
              </form>
            </div>
          ) : (
            // STANDARD SECURE LOGIN FORM
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-left border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Sign In to MMSM WebGUI</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Enter your operator or administrator credentials to proceed.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-medium">Username</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-medium">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-mono">
          <span>Modrinth Sync</span>
          <span>·</span>
          <span>Automated Backups</span>
          <span>·</span>
          <span>Role-Based Access</span>
        </div>
      </div>
    </div>
  );
};
