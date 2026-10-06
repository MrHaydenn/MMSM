import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Shield,
  Server,
  ArrowRight,
  AlertCircle,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('crafty123');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = login(username, password);
    if (!result.success) {
      setError(result.error || 'Authentication failed');
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    login(user, pass);
  };

  return (
    <div className="min-h-screen bg-[#090c10] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background ambient gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-950/60 border border-emerald-500/40">
            <span className="font-mono font-extrabold text-white text-2xl tracking-wider">CF</span>
          </div>

          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight">CraftyForge WebGUI</h1>
          <p className="text-xs text-zinc-400">
            Minecraft Server Management Wrapper with native Modrinth integration
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#11151c] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="admin or notch_op"
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
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Access Control Panel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Presets */}
          <div className="pt-4 border-t border-zinc-800/80 space-y-2">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block text-center">
              Quick Test Accounts (Click to Login)
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'crafty123')}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-purple-800/60 text-center transition-colors cursor-pointer group"
              >
                <span className="font-semibold text-xs text-purple-300 block">Admin</span>
                <span className="text-[10px] text-zinc-500 font-mono">Owner</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('notch_op', 'operator123')}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-800/60 text-center transition-colors cursor-pointer group"
              >
                <span className="font-semibold text-xs text-emerald-300 block">Operator</span>
                <span className="text-[10px] text-zinc-500 font-mono">Mod lead</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('spectator', 'viewer123')}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-center transition-colors cursor-pointer group"
              >
                <span className="font-semibold text-xs text-zinc-300 block">Viewer</span>
                <span className="text-[10px] text-zinc-500 font-mono">Read-only</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature highlight bullet pills */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-mono">
          <span>Modrinth Sync</span>
          <span>·</span>
          <span>Auto-Backups</span>
          <span>·</span>
          <span>Multi-Server</span>
          <span>·</span>
          <span>Skin API</span>
        </div>
      </div>
    </div>
  );
};
