import React, { useState } from 'react';
import {
  User as UserIcon,
  X,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Camera,
  Image,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AccountProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SKINS = [
  { name: 'Steve', user: 'MHF_Steve' },
  { name: 'Alex', user: 'MHF_Alex' },
  { name: 'Notch', user: 'Notch' },
  { name: 'jeb_', user: 'jeb_' },
  { name: 'Technoblade', user: 'Technoblade' },
  { name: 'Dinnerbone', user: 'Dinnerbone' },
  { name: 'Herobrine', user: 'MHF_Herobrine' },
  { name: 'Golem', user: 'MHF_Golem' },
];

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [selectedSkin, setSelectedSkin] = useState(currentUser?.avatarSeed || 'Steve');
  const [customUsername, setCustomUsername] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState(currentUser?.customAvatarUrl || '');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const currentAvatarSrc =
    customAvatarUrl ||
    `https://mc-heads.net/avatar/${selectedSkin}/80`;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate password change if provided
    if (newPassword || confirmPassword || currentPassword) {
      if (currentUser.password && currentPassword !== currentUser.password) {
        setErrorMessage('Current password is not correct.');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMessage('New password must be at least 4 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New password and confirmation do not match.');
        return;
      }
    }

    const effectiveSkin = customUsername.trim() || selectedSkin;

    updateProfile({
      displayName: displayName.trim() || currentUser.displayName,
      avatarSeed: effectiveSkin,
      customAvatarUrl: customAvatarUrl.trim() || undefined,
      password: newPassword ? newPassword : currentUser.password,
    });

    setSuccessMessage('Profile and account credentials updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSelectPreset = (skinUser: string) => {
    setSelectedSkin(skinUser);
    setCustomUsername('');
    setCustomAvatarUrl('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Account Profile & Settings</h2>
              <p className="text-xs text-zinc-400">Customise display name, Minecraft avatar skin, and password</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-6 flex-1">
          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-xs text-rose-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Profile Identity Card */}
          <div className="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center gap-4">
            <div className="relative">
              <img
                src={currentAvatarSrc}
                alt="Avatar"
                className="w-16 h-16 rounded-xl border-2 border-emerald-500/50 shadow-md bg-zinc-800 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://mc-heads.net/avatar/MHF_Steve/80';
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-black font-bold">
                ✓
              </div>
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-zinc-100">
                  {displayName || currentUser.displayName}
                </span>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">@{currentUser.username}</p>
              <p className="text-[11px] text-zinc-500 font-mono">
                Member since {currentUser.createdAt?.substring(0, 10) || '2024-01-01'}
              </p>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-300 font-medium">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/60"
              placeholder="e.g. SysAdmin Alex"
            />
          </div>

          {/* Avatar Skin Picker */}
          <div className="space-y-3 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Choose Profile Avatar (Minecraft Skins)</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {PRESET_SKINS.map((sk) => {
                const isSelected = selectedSkin === sk.user && !customAvatarUrl;
                return (
                  <button
                    key={sk.user}
                    type="button"
                    onClick={() => handleSelectPreset(sk.user)}
                    className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                    title={sk.name}
                  >
                    <img
                      src={`https://mc-heads.net/avatar/${sk.user}/48`}
                      alt={sk.name}
                      className="w-8 h-8 rounded mx-auto bg-zinc-800"
                    />
                    <span className="text-[9px] font-mono text-zinc-400 block mt-1 truncate">
                      {sk.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Minecraft Username */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
              <label className="text-[11px] text-zinc-400 font-mono">
                Or enter any Minecraft player username for their head:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Dream, Philza, Grian"
                  value={customUsername}
                  onChange={(e) => {
                    setCustomUsername(e.target.value);
                    if (e.target.value.trim()) {
                      setSelectedSkin(e.target.value.trim());
                      setCustomAvatarUrl('');
                    }
                  }}
                  className="flex-1 bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="space-y-3 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Change Password</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px]">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-[#0a0d12] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 cursor-pointer transition-colors"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
