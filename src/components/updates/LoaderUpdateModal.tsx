import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { MinecraftServer } from '../../types/server';
import { getLatestLoaderVersion } from '../../services/loadersApi';

interface LoaderUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetServer?: MinecraftServer;
}

export const LoaderUpdateModal: React.FC<LoaderUpdateModalProps> = ({
  isOpen,
  onClose,
  targetServer,
}) => {
  const { activeServer, upgradeLoader } = useServer();
  const srv = targetServer || activeServer;

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const info = getLatestLoaderVersion(srv.loader, srv.minecraftVersion);

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      await upgradeLoader(srv.id);
      setCompleted(true);
      setTimeout(() => {
        setCompleted(false);
        setIsUpgrading(false);
        onClose();
      }, 1500);
    } catch {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Loader Version Update</h2>
              <p className="text-xs text-zinc-400 capitalize">{srv.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version Comparison Card */}
        <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Installed</span>
            <span className="font-semibold text-zinc-300 text-sm">
              {srv.loader.toUpperCase()} {srv.loaderVersion}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-emerald-400" />

          <div className="text-right">
            <span className="text-[10px] text-emerald-400 uppercase block font-semibold">Latest Upstream</span>
            <span className="font-bold text-emerald-300 text-sm">
              {srv.loader.toUpperCase()} {info.latestVersion}
            </span>
          </div>
        </div>

        {/* Changelog preview */}
        <div className="space-y-1.5 text-xs">
          <span className="text-zinc-400 font-mono text-[11px] uppercase">Changelog Highlights</span>
          <div className="p-3 bg-[#0a0d12] border border-zinc-800 rounded-lg text-zinc-300 text-xs leading-relaxed">
            {info.changelogSnippet}
          </div>
        </div>

        {/* Safety Note */}
        <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Config files and world saves are safely preserved during loader replacement.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpgrading}
            className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
          >
            Later
          </button>

          <button
            onClick={handleUpgrade}
            disabled={isUpgrading || completed}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {completed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Upgraded!</span>
              </>
            ) : isUpgrading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Upgrading Loader...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Click Upgrade</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
