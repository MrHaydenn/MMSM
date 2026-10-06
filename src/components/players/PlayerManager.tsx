import React, { useState } from 'react';
import {
  Users,
  Shield,
  ShieldAlert,
  UserX,
  UserCheck,
  MessageSquare,
  Search,
  Heart,
  Compass,
  Wifi,
  Clock,
  Sparkles,
  X,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { Player } from '../../types/server';

export const PlayerManager: React.FC = () => {
  const {
    activeServer,
    kickPlayer,
    banPlayer,
    unbanPlayer,
    togglePlayerOp,
    togglePlayerWhitelist,
    approveWhitelistRequest,
    denyWhitelistRequest,
    executeCommand,
  } = useServer();
  const { canPerformAction } = useAuth();

  const [activeTab, setActiveTab] = useState<'online' | 'whitelist' | 'requests' | 'banned'>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modals for Kick / Ban / Add Whitelist
  const [kickModalPlayer, setKickModalPlayer] = useState<Player | null>(null);
  const [kickReason, setKickReason] = useState('Violating server community rules');

  const [banModalPlayer, setBanModalPlayer] = useState<Player | null>(null);
  const [banReason, setBanReason] = useState('Banned by server operator');

  const [newWhitelistUser, setNewWhitelistUser] = useState('');

  const players = activeServer.players;
  const whitelistRequests = activeServer.whitelistRequests || [];

  const onlinePlayers = players.filter((p) => p.online);
  const whitelistedPlayers = players.filter((p) => p.isWhitelisted);
  const bannedPlayers = players.filter((p) => p.isBanned);

  const displayedPlayers = (
    activeTab === 'online'
      ? onlinePlayers
      : activeTab === 'whitelist'
      ? whitelistedPlayers
      : bannedPlayers
  ).filter((p) => p.username.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleKickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kickModalPlayer) return;
    kickPlayer(activeServer.id, kickModalPlayer.username, kickReason);
    setKickModalPlayer(null);
    if (selectedPlayer?.username === kickModalPlayer.username) {
      setSelectedPlayer(null);
    }
  };

  const handleBanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banModalPlayer) return;
    banPlayer(activeServer.id, banModalPlayer.username, banReason);
    setBanModalPlayer(null);
    if (selectedPlayer?.username === banModalPlayer.username) {
      setSelectedPlayer(null);
    }
  };

  const handleAddWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhitelistUser.trim()) return;
    const name = newWhitelistUser.trim();

    // Check if player already exists in roster
    const exists = players.find((p) => p.username.toLowerCase() === name.toLowerCase());
    if (exists) {
      if (!exists.isWhitelisted) togglePlayerWhitelist(activeServer.id, exists.username);
    } else {
      executeCommand(`/whitelist add ${name}`, activeServer.id);
    }
    setNewWhitelistUser('');
  };

  const formatPlaytime = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hours}h ${m}m`;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Players</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Player roster, moderation, and character telemetry for <strong className="text-zinc-200">{activeServer.name}</strong> · Max Capacity: {activeServer.properties.maxPlayers} players
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab('online')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'online'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Online Now ({onlinePlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'whitelist'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Whitelist ({whitelistedPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-zinc-800 text-amber-300 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Join Requests</span>
            {whitelistRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold text-[10px]">
                {whitelistRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('banned')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'banned'
                ? 'bg-zinc-800 text-rose-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Banned ({bannedPlayers.length})
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Whitelist Banner: Notice if unwhitelisted players attempted to connect */}
      {activeTab === 'whitelist' && whitelistRequests.length > 0 && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-600/50 rounded-xl text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{whitelistRequests.length} unwhitelisted player(s)</strong> attempted to connect to the server and were rejected.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('requests')}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Review Join Requests
          </button>
        </div>
      )}

      {/* Filter & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by username..."
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        {activeTab === 'whitelist' && canPerformAction('execute_commands') && (
          <form onSubmit={handleAddWhitelist} className="flex items-center gap-2">
            <input
              type="text"
              value={newWhitelistUser}
              onChange={(e) => setNewWhitelistUser(e.target.value)}
              placeholder="Minecraft username..."
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              type="submit"
              disabled={!newWhitelistUser.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              Add to Whitelist
            </button>
          </form>
        )}
      </div>

      {/* Whitelist Join Requests Tab */}
      {activeTab === 'requests' ? (
        <div className="space-y-4">
          <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Pending Whitelist Join Attempts ({whitelistRequests.length})</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Players who attempted to join while whitelist enforcement is active. Approve with 1-click to automatically add to whitelist.json.
              </p>
            </div>
          </div>

          {whitelistRequests.length === 0 ? (
            <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-12 text-center space-y-3">
              <Check className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-zinc-200 font-semibold text-sm">No Pending Join Requests</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                No unwhitelisted players have recently attempted to connect to port {activeServer.port}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {whitelistRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#11151c] border border-amber-900/40 hover:border-amber-700/60 rounded-xl p-4 flex flex-col justify-between space-y-4 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <img
                      src={req.avatarUrl || `https://mc-heads.net/avatar/${req.username}/48`}
                      alt={req.username}
                      className="w-12 h-12 rounded-xl border border-zinc-700 bg-zinc-900 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                      }}
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-zinc-100 truncate">{req.username}</h4>
                        <span className="text-[10px] text-zinc-500 font-mono">{req.timestamp}</span>
                      </div>
                      <p className="text-xs text-amber-300 font-mono">IP: {req.ip}</p>
                      <p className="text-xs text-zinc-400 italic">
                        {req.reason || 'Kicked: You are not whitelisted on this server!'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        denyWhitelistRequest(activeServer.id, req.id);
                        setActionNotice(`Denied join request from ${req.username}.`);
                        setTimeout(() => setActionNotice(null), 3000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Deny Attempt
                    </button>
                    <button
                      onClick={() => {
                        approveWhitelistRequest(activeServer.id, req.id);
                        setActionNotice(`Approved and added ${req.username} to whitelist!`);
                        setTimeout(() => setActionNotice(null), 3000);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Whitelist</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : displayedPlayers.length === 0 ? (
        <div className="bg-[#11151c] border border-zinc-800 rounded-xl p-12 text-center space-y-3">
          <Users className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-semibold text-sm">
            {activeTab === 'online'
              ? 'No players currently online'
              : activeTab === 'whitelist'
              ? 'Whitelist is currently empty'
              : 'No banned players'}
          </p>
          <p className="text-xs text-zinc-500">
            {activeTab === 'online'
              ? 'Start the server or wait for players to join via port ' + activeServer.port
              : 'Add trusted players to restrict access.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPlayers.map((player) => (
            <div
              key={player.uuid}
              className="bg-[#11151c] border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                {/* Real Minecraft Skin Avatar */}
                <div
                  onClick={() => setSelectedPlayer(player)}
                  className="relative cursor-pointer group shrink-0"
                >
                  <img
                    src={`https://mc-heads.net/avatar/${player.username}/64`}
                    alt={player.username}
                    className="w-14 h-14 rounded-xl border border-zinc-700 bg-zinc-900 group-hover:border-emerald-500 transition-colors"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://mc-heads.net/avatar/MHF_Steve/64';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-mono transition-opacity">
                    View
                  </div>
                </div>

                {/* Player details */}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      onClick={() => setSelectedPlayer(player)}
                      className="font-bold text-sm text-zinc-100 hover:text-emerald-400 cursor-pointer truncate"
                    >
                      {player.username}
                    </h3>

                    {player.isOp && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-800/50 text-purple-300 font-semibold flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        OP
                      </span>
                    )}

                    {player.isBanned && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-800/50 text-rose-300 font-semibold">
                        BANNED
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-500 font-mono truncate">
                    UUID: {player.uuid.substring(0, 8)}...
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      {player.pingMs}ms
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formatPlaytime(player.playtimeMinutes)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status pills (coords, dimension, health) */}
              <div className="pt-2 border-t border-zinc-800/70 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span className="capitalize">
                  {player.coords.dimension} ({player.coords.x}, {player.coords.y}, {player.coords.z})
                </span>

                <div className="flex items-center gap-1 text-rose-400">
                  <Heart className="w-3 h-3 fill-current" />
                  <span>{player.health}/20</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex items-center justify-between gap-1.5 border-t border-zinc-800/50">
                <button
                  onClick={() => setSelectedPlayer(player)}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors"
                >
                  Inspect 3D Skin
                </button>

                {canPerformAction('execute_commands') && (
                  <div className="flex items-center gap-1">
                    {player.isBanned ? (
                      <button
                        onClick={() => unbanPlayer(activeServer.id, player.username)}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-emerald-950/40 text-emerald-400 text-xs font-medium border border-zinc-700 transition-colors"
                      >
                        Unban
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setKickModalPlayer(player)}
                          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 text-xs font-medium border border-zinc-800 transition-colors"
                          title="Kick player"
                        >
                          Kick
                        </button>
                        <button
                          onClick={() => setBanModalPlayer(player)}
                          className="px-2 py-1 rounded bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900 text-xs font-medium transition-colors"
                          title="Ban player"
                        >
                          Ban
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FULL 3D SKIN INSPECTOR MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#11151c] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100">{selectedPlayer.username}</span>
                <span className="text-xs text-zinc-500 font-mono">Character Dossier</span>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: 3D Body & Telemetry */}
            <div className="p-6 flex flex-col md:flex-row items-center gap-6">
              {/* Full 3D Body Image from mc-heads */}
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 flex flex-col items-center shrink-0">
                <img
                  src={`https://mc-heads.net/body/${selectedPlayer.username}/160`}
                  alt={`${selectedPlayer.username} 3D Skin`}
                  className="h-56 object-contain drop-shadow-2xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://mc-heads.net/body/MHF_Steve/160';
                  }}
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-2 uppercase">Official Mojang Skin</span>
              </div>

              {/* Player Attributes */}
              <div className="space-y-3 flex-1 text-xs font-mono w-full">
                <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">UUID</span>
                  <p className="text-zinc-200 select-all break-all">{selectedPlayer.uuid}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase">Gamemode</span>
                    <p className="text-emerald-400 font-semibold capitalize">{selectedPlayer.gameMode}</p>
                  </div>
                  <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase">Health / Hunger</span>
                    <p className="text-rose-400 font-semibold">
                      {selectedPlayer.health} HP / {selectedPlayer.food} Food
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Coordinates</span>
                  <p className="text-zinc-200">
                    X: {selectedPlayer.coords.x} · Y: {selectedPlayer.coords.y} · Z: {selectedPlayer.coords.z} (
                    <span className="capitalize text-emerald-400">{selectedPlayer.coords.dimension}</span>)
                  </p>
                </div>

                <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Total Playtime</span>
                  <p className="text-zinc-200">{formatPlaytime(selectedPlayer.playtimeMinutes)}</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            {canPerformAction('execute_commands') && (
              <div className="p-4 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => togglePlayerOp(activeServer.id, selectedPlayer.username)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedPlayer.isOp
                      ? 'bg-purple-950/50 text-purple-300 border-purple-800 hover:bg-purple-950/80'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
                  }`}
                >
                  {selectedPlayer.isOp ? 'Revoke OP Permission' : 'Grant Server OP'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setKickModalPlayer(selectedPlayer);
                      setSelectedPlayer(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                  >
                    Kick
                  </button>
                  <button
                    onClick={() => {
                      setBanModalPlayer(selectedPlayer);
                      setSelectedPlayer(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    Ban Player
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KICK MODAL */}
      {kickModalPlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleKickSubmit}
            className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-zinc-100 text-base">Kick {kickModalPlayer.username}</h3>
            <p className="text-xs text-zinc-400">
              The player will be immediately disconnected from {activeServer.name}.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Kick Reason</label>
              <input
                type="text"
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKickModalPlayer(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                Confirm Kick
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BAN MODAL */}
      {banModalPlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleBanSubmit}
            className="bg-[#11151c] border border-zinc-800 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-rose-400 text-base">Ban {banModalPlayer.username}</h3>
            <p className="text-xs text-zinc-400">
              This will add the player&apos;s UUID to <code className="text-zinc-300">banned-players.json</code> and disconnect them.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Ban Reason</label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBanModalPlayer(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Confirm Ban
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
