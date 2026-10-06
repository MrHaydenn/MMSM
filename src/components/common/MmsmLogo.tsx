import React from 'react';
import { useServer } from '../../context/ServerContext';
import {
  Sword,
  Pickaxe,
  Eye,
  Server,
  Sparkles,
  Shield,
  Box,
} from 'lucide-react';

interface MmsmLogoProps {
  className?: string;
  size?: number;
}

export const MmsmLogo: React.FC<MmsmLogoProps> = ({ className = 'w-9 h-9', size = 36 }) => {
  const { wrapperSettings } = useServer();
  const emblem = wrapperSettings?.customEmblemIcon || 'sword';
  const customUrl = wrapperSettings?.customWrapperLogoUrl;
  const accent = wrapperSettings?.accentColor || 'emerald';

  const getAccentGlow = () => {
    switch (accent) {
      case 'blue':
        return { bg: 'from-blue-600 to-indigo-900', border: 'border-blue-500/40', text: 'text-blue-400', shadow: 'shadow-blue-950/50' };
      case 'purple':
        return { bg: 'from-purple-600 to-indigo-950', border: 'border-purple-500/40', text: 'text-purple-400', shadow: 'shadow-purple-950/50' };
      case 'red':
        return { bg: 'from-rose-600 to-red-950', border: 'border-rose-500/40', text: 'text-rose-400', shadow: 'shadow-rose-950/50' };
      case 'amber':
        return { bg: 'from-amber-500 to-amber-950', border: 'border-amber-500/40', text: 'text-amber-400', shadow: 'shadow-amber-950/50' };
      case 'cyan':
        return { bg: 'from-cyan-500 to-teal-950', border: 'border-cyan-500/40', text: 'text-cyan-400', shadow: 'shadow-cyan-950/50' };
      case 'rose':
        return { bg: 'from-pink-500 to-rose-950', border: 'border-pink-500/40', text: 'text-pink-400', shadow: 'shadow-pink-950/50' };
      case 'zinc':
        return { bg: 'from-zinc-600 to-zinc-950', border: 'border-zinc-500/40', text: 'text-zinc-300', shadow: 'shadow-zinc-950/50' };
      case 'emerald':
      default:
        return { bg: 'from-emerald-600 to-teal-950', border: 'border-emerald-500/40', text: 'text-emerald-400', shadow: 'shadow-emerald-950/50' };
    }
  };

  const theme = getAccentGlow();

  if (customUrl) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shadow-lg ${theme.border} border flex items-center justify-center shrink-0 select-none bg-zinc-900 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={customUrl}
          alt="Wrapper Logo"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Render Preset Icon Emblem
  const renderIcon = () => {
    const iconSize = Math.max(16, Math.floor(size * 0.55));
    switch (emblem) {
      case 'pickaxe':
        return <Pickaxe size={iconSize} className={`${theme.text} drop-shadow-md`} />;
      case 'ender_eye':
        return <Eye size={iconSize} className={`${theme.text} drop-shadow-md animate-pulse`} />;
      case 'server_rack':
        return <Server size={iconSize} className={`${theme.text} drop-shadow-md`} />;
      case 'golden_apple':
        return <Sparkles size={iconSize} className={`${theme.text} drop-shadow-md`} />;
      case 'shield':
        return <Shield size={iconSize} className={`${theme.text} drop-shadow-md`} />;
      case 'cube':
        return <Box size={iconSize} className={`${theme.text} drop-shadow-md`} />;
      case 'sword':
      default:
        return <Sword size={iconSize} className={`${theme.text} drop-shadow-md`} />;
    }
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden shadow-lg ${theme.border} border bg-gradient-to-br ${theme.bg} flex items-center justify-center shrink-0 select-none transition-all ${className} ${theme.shadow}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/40 pointer-events-none" />
      {renderIcon()}
    </div>
  );
};
