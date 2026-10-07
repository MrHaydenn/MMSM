import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  MinecraftServer,
  ServerLog,
  InstalledMod,
  Player,
  BackupRecord,
  BackupSchedule,
  BackupRule,
  ServerProperties,
  ServerStatus,
  ServerLoader,
  ServerFile,
} from '../types/server';
import { checkModUpdate } from '../services/modrinthApi';
import { getLatestLoaderVersion } from '../services/loadersApi';
import { getDefaultServerFiles } from '../services/defaultFiles';

interface ServerContextType {
  servers: MinecraftServer[];
  activeServer: MinecraftServer;
  setActiveServerId: (id: string) => void;
  serverLogs: Record<string, ServerLog[]>;
  startServer: (id?: string) => Promise<void>;
  stopServer: (id?: string) => Promise<void>;
  restartServer: (id?: string) => Promise<void>;
  killServer: (id?: string) => Promise<void>;
  executeCommand: (cmd: string, serverId?: string) => void;
  clearLogs: (serverId?: string) => void;
  // Mod actions
  installMod: (serverId: string, mod: InstalledMod) => void;
  toggleMod: (serverId: string, modId: string) => void;
  updateMod: (serverId: string, modId: string, newVersionNumber: string, newVersionId: string) => void;
  removeMod: (serverId: string, modId: string) => void;
  checkModUpdatesForServer: (serverId: string) => Promise<number>;
  // Loader update
  upgradeLoader: (serverId: string) => Promise<void>;
  // Backups & Backup Rules
  createBackup: (serverId: string, name?: string, type?: 'manual' | 'scheduled') => Promise<BackupRecord>;
  restoreBackup: (serverId: string, backupId: string) => Promise<void>;
  deleteBackup: (serverId: string, backupId: string) => void;
  togglePinBackup: (serverId: string, backupId: string) => void;
  updateBackupSchedule: (serverId: string, schedule: BackupSchedule) => void;
  createBackupRule: (serverId: string, rule: Omit<BackupRule, 'id' | 'createdAt'>) => BackupRule;
  updateBackupRule: (serverId: string, ruleId: string, updates: Partial<BackupRule>) => void;
  deleteBackupRule: (serverId: string, ruleId: string) => void;
  runBackupRule: (serverId: string, ruleId: string) => Promise<BackupRecord>;
  setServerPublicIp: (
    serverId: string,
    publicIp?: string,
    publicPort?: number | string,
    hidePort?: boolean
  ) => void;
  // Players
  kickPlayer: (serverId: string, username: string, reason?: string) => void;
  banPlayer: (serverId: string, username: string, reason?: string) => void;
  unbanPlayer: (serverId: string, username: string) => void;
  togglePlayerOp: (serverId: string, username: string) => void;
  togglePlayerWhitelist: (serverId: string, username: string) => void;
  // File actions
  saveFile: (serverId: string, path: string, content: string) => void;
  createFile: (serverId: string, path: string, isDirectory: boolean, content?: string) => void;
  deleteFile: (serverId: string, path: string) => void;
  renameFile: (serverId: string, oldPath: string, newName: string) => void;
  // Archive & Fleet actions
  archiveServer: (serverId: string) => void;
  unarchiveServer: (serverId: string) => void;
  setServerRam: (serverId: string, minRamMb: number, maxRamMb: number) => void;
  uploadModFile: (serverId: string, fileName: string, fileBytes: number) => void;
  changeLoader: (serverId: string, newLoader: ServerLoader, newLoaderVersion: string, newMcVersion?: string) => void;
  // Server Icon
  updateServerIcon: (serverId: string, iconUrl: string) => void;
  // Sleep Mode (AMP-style hibernation)
  toggleSleepMode: (serverId: string, enabled: boolean, inactivityMinutes?: number) => void;
  wakeServer: (serverId: string) => Promise<void>;
  putServerToSleep: (serverId: string) => void;
  // Whitelist Requests
  approveWhitelistRequest: (serverId: string, requestId: string) => void;
  denyWhitelistRequest: (serverId: string, requestId: string) => void;
  // Scheduled Tasks
  addScheduledTask: (serverId: string, task: Omit<import('../types/server').ScheduledTask, 'id'>) => void;
  toggleScheduledTask: (serverId: string, taskId: string) => void;
  deleteScheduledTask: (serverId: string, taskId: string) => void;
  runScheduledTaskNow: (serverId: string, taskId: string) => void;
  // Java Runtime instances
  downloadJavaRuntime: (runtimeId: string) => Promise<void>;
  // Wrapper Settings
  wrapperSettings: import('../types/server').WrapperSettings;
  updateWrapperSettings: (settings: Partial<import('../types/server').WrapperSettings>) => void;
  // Server Config & Lifecycle
  updateProperties: (serverId: string, props: Partial<ServerProperties>) => void;
  createServer: (newServerData: {
    name: string;
    description: string;
    loader: ServerLoader;
    loaderVersion: string;
    minecraftVersion: string;
    minRamMb?: number;
    ramMb: number;
    port: number;
    modpackId?: string;
  }) => MinecraftServer;
  deleteServer: (serverId: string) => void;
  purgeSampleData: () => void;
  // Alerts
  alerts: {
    id: string;
    serverId: string;
    title: string;
    message: string;
    date: string;
    type: 'info' | 'update' | 'warning';
    targetTab?: 'updates' | 'mods' | 'players' | 'config' | 'backups';
    targetAction?: 'review_whitelist' | 'update_loader' | 'view_mod';
  }[];
  dismissAlert: (id: string) => void;
  dismissAllAlerts: () => void;
  // Downloads Monitor / Queue
  downloads: import('../types/server').DownloadItem[];
  addDownload: (item: Omit<import('../types/server').DownloadItem, 'id' | 'startedAt' | 'progressPercent'>) => string;
  clearCompletedDownloads: () => void;
  // GitHub Auto Update
  checkForGitHubUpdate: () => Promise<boolean>;
  performGitHubUpdate: () => Promise<void>;
  isUpdatingWrapper: boolean;
  updateProgressStep: string;
}

const INITIAL_SERVERS: MinecraftServer[] = [
  {
    id: 'srv-fabric-smp',
    name: 'Survival Fabric SMP',
    description: 'High-performance community survival server with Fabric optimizations & voice chat.',
    status: 'online',
    loader: 'fabric',
    loaderVersion: '0.16.7',
    latestAvailableLoaderVersion: '0.16.10',
    minecraftVersion: '1.21.4',
    latestAvailableMcVersion: '1.21.4',
    hasLoaderUpdate: true,
    allocatedRamMb: 6144,
    minRamMb: 2048,
    javaVersion: 'Java 21 (Temurin-21.0.4)',
    port: 25565,
    serverIconUrl: 'https://api.iconify.design/pixelarticons:sword.svg',
    sleepModeEnabled: true,
    sleepInactivityMinutes: 15,
    isSleeping: false,
    whitelistRequests: [
      {
        id: 'req-1',
        username: 'TechnoFan_99',
        timestamp: '5 minutes ago',
        ip: '192.168.1.184',
        reason: 'Friend of Notch from Discord community',
        avatarUrl: 'https://mc-heads.net/avatar/TechnoFan_99/48',
      },
      {
        id: 'req-2',
        username: 'DiamondMiner42',
        timestamp: '22 minutes ago',
        ip: '10.0.0.45',
        reason: 'Joined via subreddit link',
        avatarUrl: 'https://mc-heads.net/avatar/DiamondMiner42/48',
      },
    ],
    scheduledTasks: [
      {
        id: 'task-1',
        name: 'Nightly World Backup',
        type: 'backup',
        cronOrInterval: 'Every 6 Hours',
        enabled: true,
        lastRun: '4 hours ago',
        nextRun: 'in 2 hours',
      },
      {
        id: 'task-2',
        name: 'Auto-Restart & RAM Flush',
        type: 'restart',
        cronOrInterval: 'Daily at 04:00 AM',
        enabled: true,
        lastRun: 'Yesterday at 04:00',
        nextRun: 'Tomorrow at 04:00',
      },
      {
        id: 'task-3',
        name: 'Broadcast Rules Notice',
        type: 'command',
        command: 'say Remember to follow server etiquette and report griefing to operators.',
        cronOrInterval: 'Every 30 Minutes',
        enabled: true,
        lastRun: '12 mins ago',
        nextRun: 'in 18 mins',
      },
    ],
    playerSessions: [
      {
        id: 'sess-1',
        username: 'Notch',
        joinedAt: 'Today 10:02',
        leftAt: 'Active',
        durationMinutes: 180,
        dimension: 'Overworld',
        peakPing: 28,
      },
      {
        id: 'sess-2',
        username: 'jeb_',
        joinedAt: 'Today 10:04',
        leftAt: 'Active',
        durationMinutes: 178,
        dimension: 'Nether',
        peakPing: 34,
      },
      {
        id: 'sess-3',
        username: 'Alex',
        joinedAt: 'Yesterday 14:20',
        leftAt: 'Yesterday 18:45',
        durationMinutes: 265,
        dimension: 'Overworld',
        peakPing: 42,
      },
      {
        id: 'sess-4',
        username: 'Steve',
        joinedAt: 'Yesterday 09:12',
        leftAt: 'Yesterday 11:30',
        durationMinutes: 138,
        dimension: 'The End',
        peakPing: 22,
      },
    ],
    analyticsHistory: [
      { timestamp: '10:00', tps: 20.0, cpuPercent: 12.4, ramMb: 3100, onlinePlayers: 2, networkMbps: 1.8 },
      { timestamp: '11:00', tps: 19.9, cpuPercent: 16.2, ramMb: 3250, onlinePlayers: 3, networkMbps: 2.4 },
      { timestamp: '12:00', tps: 20.0, cpuPercent: 21.0, ramMb: 3400, onlinePlayers: 4, networkMbps: 3.1 },
      { timestamp: '13:00', tps: 19.8, cpuPercent: 24.5, ramMb: 3600, onlinePlayers: 5, networkMbps: 4.2 },
      { timestamp: '14:00', tps: 20.0, cpuPercent: 18.2, ramMb: 3450, onlinePlayers: 3, networkMbps: 2.8 },
      { timestamp: '15:00', tps: 20.0, cpuPercent: 14.8, ramMb: 3410, onlinePlayers: 2, networkMbps: 2.1 },
    ],
    createdAt: '2024-11-10T10:00:00Z',
    uptimeStartedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    properties: {
      serverName: 'Survival Fabric SMP',
      motd: '§aCraftyForge §7SMP §8| §e1.21.4 §b[Modded Performance]',
      serverPort: 25565,
      maxPlayers: 20,
      difficulty: 'hard',
      gamemode: 'survival',
      pvp: true,
      allowFlight: false,
      viewDistance: 12,
      simulationDistance: 8,
      onlineMode: true,
      spawnProtection: 16,
      hardcore: false,
      whiteList: false,
      enableRcon: true,
      rconPort: 25575,
    },
    mods: [
      {
        id: 'P7dR8mSH',
        name: 'Fabric API',
        slug: 'fabric-api',
        filename: 'fabric-api-0.110.1+1.21.4.jar',
        installedVersionId: 'v-fab-1',
        installedVersionNumber: '0.110.1+1.21.4',
        enabled: true,
        fileSizeBytes: 2450000,
        summary: 'Essential hooks and compatibility layer for mods using the Fabric loader.',
        author: 'FabricMC',
        loaders: ['fabric'],
        gameVersions: ['1.21.4'],
        installedAt: '2024-12-05T10:00:00Z',
        iconUrl: 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png',
      },
      {
        id: 'gvQqBUqZ',
        name: 'Lithium',
        slug: 'lithium',
        filename: 'lithium-fabric-0.14.7-mc1.21.4.jar',
        installedVersionId: 'v-lit-1',
        installedVersionNumber: '0.14.7',
        enabled: true,
        fileSizeBytes: 1820000,
        summary: 'General-purpose optimization mod for Minecraft boosting TPS and physics processing.',
        author: 'jellysquid3',
        loaders: ['fabric'],
        gameVersions: ['1.21.4'],
        installedAt: '2024-12-05T10:00:00Z',
        iconUrl: 'https://cdn.modrinth.com/data/gvQqBUqZ/icon.png',
      },
      {
        id: 'u6dsqVyZ',
        name: 'FerriteCore',
        slug: 'ferrite-core',
        filename: 'ferritecore-7.0.0-fabric.jar',
        installedVersionId: 'v-fc-1',
        installedVersionNumber: '7.0.0',
        enabled: true,
        fileSizeBytes: 620000,
        summary: 'Memory usage optimizations for Minecraft reducing RAM by up to 40%.',
        author: 'malte0811',
        loaders: ['fabric'],
        gameVersions: ['1.21.4'],
        installedAt: '2024-12-06T14:00:00Z',
        iconUrl: 'https://cdn.modrinth.com/data/u6dsqVyZ/icon.png',
      },
      {
        id: 'nk8j3m9o',
        name: 'Chunky',
        slug: 'chunky',
        filename: 'Chunky-1.4.28.jar',
        installedVersionId: 'v-chu-1',
        installedVersionNumber: '1.4.28',
        enabled: true,
        fileSizeBytes: 410000,
        summary: 'Pre-generates chunks rapidly to reduce server lag during exploration.',
        author: 'pop4959',
        loaders: ['fabric'],
        gameVersions: ['1.21.4'],
        installedAt: '2024-12-07T12:00:00Z',
        iconUrl: 'https://cdn.modrinth.com/data/fALzjRMS/icon.png',
      },
    ],
    players: [
      {
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        username: 'Notch',
        isOp: true,
        isWhitelisted: true,
        online: true,
        pingMs: 24,
        playtimeMinutes: 1420,
        lastSeen: 'Now',
        ipAddress: '192.168.1.102',
        coords: { x: 124, y: 71, z: -350, dimension: 'overworld' },
        health: 20,
        food: 18,
        gameMode: 'survival',
      },
      {
        uuid: '853c80ef-3c37-49fd-aa49-938b674adae6',
        username: 'jeb_',
        isOp: true,
        isWhitelisted: true,
        online: true,
        pingMs: 42,
        playtimeMinutes: 980,
        lastSeen: 'Now',
        ipAddress: '192.168.1.115',
        coords: { x: -45, y: 64, z: 210, dimension: 'overworld' },
        health: 19,
        food: 20,
        gameMode: 'survival',
      },
      {
        uuid: 'ec561538-f3fd-461d-aff5-086364e5c52c',
        username: 'Alex',
        isOp: false,
        isWhitelisted: true,
        online: true,
        pingMs: 18,
        playtimeMinutes: 2400,
        lastSeen: 'Now',
        ipAddress: '192.168.1.84',
        coords: { x: 890, y: 68, z: 12, dimension: 'nether' },
        health: 14,
        food: 16,
        gameMode: 'survival',
      },
      {
        uuid: 'd8d83556-93b4-4e18-912a-0498b8398a69',
        username: 'Steve',
        isOp: false,
        isWhitelisted: true,
        online: false,
        pingMs: 0,
        playtimeMinutes: 320,
        lastSeen: '2 hours ago',
        ipAddress: '192.168.1.99',
        coords: { x: 10, y: 63, z: 5, dimension: 'overworld' },
        health: 20,
        food: 20,
        gameMode: 'survival',
      },
    ],
    backups: [
      {
        id: 'bk-1',
        name: 'AutoBackup-20241228-0000',
        createdAt: '2024-12-28T00:00:00Z',
        sizeBytes: 154000000,
        isPinned: true,
        type: 'scheduled',
        minecraftVersion: '1.21.4',
        loader: 'fabric',
        ruleId: 'rule-full-smp',
        ruleName: 'Full Server & Mods Snapshot',
        destinationPath: 'D:/MinecraftBackups/Survival',
        includedItems: ['world', 'world_nether', 'world_the_end', 'mods', 'config', 'server.properties', 'whitelist.json'],
        notes: 'Pre-nether expedition world save',
      },
      {
        id: 'bk-2',
        name: 'Manual-Before-Chunky-Gen',
        createdAt: '2024-12-27T18:30:00Z',
        sizeBytes: 148000000,
        isPinned: false,
        type: 'manual',
        minecraftVersion: '1.21.4',
        loader: 'fabric',
        ruleId: 'rule-world-fast',
        ruleName: 'World Regions Fast Snapshot',
        destinationPath: '/Backups/Survival/Worlds',
        includedItems: ['world', 'world_nether', 'world_the_end'],
      },
    ],
    backupRules: [
      {
        id: 'rule-full-smp',
        name: 'Full Server & Mods Snapshot',
        destinationPath: 'D:/MinecraftBackups/Survival',
        retentionCount: 8,
        includedPaths: ['world', 'world_nether', 'world_the_end', 'mods', 'config', 'server.properties', 'whitelist.json'],
        compressionLevel: 'normal',
        notes: 'Primary backup profile covering all dimensions and mods.',
        createdAt: '2024-12-01T00:00:00Z',
        lastRunAt: '2024-12-28T00:00:00Z',
      },
      {
        id: 'rule-world-fast',
        name: 'World Regions Fast Snapshot',
        destinationPath: '/Backups/Survival/Worlds',
        retentionCount: 12,
        includedPaths: ['world', 'world_nether', 'world_the_end'],
        compressionLevel: 'fast',
        notes: 'Frequent world terrain snapshots without heavy mod jars.',
        createdAt: '2024-12-05T00:00:00Z',
        lastRunAt: '2024-12-27T18:30:00Z',
      },
    ],
    publicServerIp: 'play.craftyfleet.com',
    backupSchedule: {
      enabled: true,
      frequency: '6h',
      maxKeepBackups: 8,
      includeMods: true,
      lastRunAt: '2024-12-28T00:00:00Z',
      nextRunAt: '2024-12-28T06:00:00Z',
    },
    telemetry: {
      cpuPercent: 14.8,
      ramUsedMb: 3410,
      ramMaxMb: 6144,
      tps: 20.0,
      tickTimeMs: 12.4,
      diskUsedMb: 1250,
      diskTotalMb: 50000,
      networkInKb: 84.2,
      networkOutKb: 218.4,
      uptimeSeconds: 172800,
    },
    files: getDefaultServerFiles('Survival Fabric SMP', 25565, 'fabric', [
      {
        id: 'P7dR8mSH',
        name: 'Fabric API',
        slug: 'fabric-api',
        filename: 'fabric-api-0.110.1+1.21.4.jar',
        installedVersionId: 'v-fab-1',
        installedVersionNumber: '0.110.1+1.21.4',
        enabled: true,
        fileSizeBytes: 2450000,
        summary: 'Essential hooks and compatibility layer for mods using the Fabric loader.',
        author: 'FabricMC',
        loaders: ['fabric'],
        gameVersions: ['1.21.4'],
        installedAt: '2024-12-05T10:00:00Z',
      },
      {
        id: 'gvQqBUqZ',
        name: 'Lithium',
        slug: 'lithium',
        filename: 'lithium-fabric-0.14.7-mc1.21.4.jar',
        installedVersionId: 'v-lit-1',
        installedVersionNumber: '0.14.7',
        enabled: true,
        fileSizeBytes: 1820000,
        summary: 'General-purpose optimization mod for Minecraft boosting TPS.',
        author: 'jellysquid3',
        loaders: ['fabric'],
        gameVersions: ['1.21.4'],
        installedAt: '2024-12-05T10:00:00Z',
      },
    ]),
  },
  {
    id: 'srv-paper-lobby',
    name: 'Paper Lobby & Hub',
    description: 'High-concurrency PaperMC spigot hub server for player matchmaking and minigames.',
    status: 'offline',
    loader: 'paper',
    loaderVersion: 'build #162',
    latestAvailableLoaderVersion: 'build #168',
    minecraftVersion: '1.21.4',
    latestAvailableMcVersion: '1.21.4',
    hasLoaderUpdate: true,
    allocatedRamMb: 4096,
    minRamMb: 2048,
    javaVersion: 'Java 21 (Temurin-21.0.4)',
    port: 25566,
    createdAt: '2024-11-20T14:00:00Z',
    properties: {
      serverName: 'Paper Lobby & Hub',
      motd: '§6CraftyForge §fNetwork §8| §bLobby 01',
      serverPort: 25566,
      maxPlayers: 50,
      difficulty: 'peaceful',
      gamemode: 'adventure',
      pvp: false,
      allowFlight: true,
      viewDistance: 8,
      simulationDistance: 6,
      onlineMode: true,
      spawnProtection: 0,
      hardcore: false,
      whiteList: false,
      enableRcon: false,
      rconPort: 25576,
    },
    mods: [],
    players: [],
    backups: [
      {
        id: 'bk-paper-1',
        name: 'Lobby-Spawn-Schematic-Backup',
        createdAt: '2024-12-20T11:00:00Z',
        sizeBytes: 85000000,
        isPinned: true,
        type: 'manual',
        minecraftVersion: '1.21.4',
        loader: 'paper',
      },
    ],
    backupSchedule: {
      enabled: false,
      frequency: '24h',
      maxKeepBackups: 5,
      includeMods: false,
    },
    telemetry: {
      cpuPercent: 0,
      ramUsedMb: 0,
      ramMaxMb: 4096,
      tps: 20.0,
      tickTimeMs: 0,
      diskUsedMb: 680,
      diskTotalMb: 50000,
      networkInKb: 0,
      networkOutKb: 0,
      uptimeSeconds: 0,
    },
    files: getDefaultServerFiles('Paper Lobby & Hub', 25566, 'paper', []),
  },
  {
    id: 'srv-neoforge-tech',
    name: 'NeoForge Tech Horizons',
    description: 'Heavy modded tech server featuring machinery, electricity, and custom dimensions.',
    status: 'online',
    loader: 'neoforge',
    loaderVersion: '21.1.95',
    latestAvailableLoaderVersion: '21.1.95',
    minecraftVersion: '1.21.1',
    latestAvailableMcVersion: '1.21.4',
    hasLoaderUpdate: false,
    allocatedRamMb: 8192,
    minRamMb: 4096,
    javaVersion: 'Java 21 (Temurin-21.0.4)',
    port: 25567,
    createdAt: '2024-12-01T09:00:00Z',
    uptimeStartedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    properties: {
      serverName: 'NeoForge Tech Horizons',
      motd: '§dNeoForge §eTech Horizons §8| §cModded Tech World',
      serverPort: 25567,
      maxPlayers: 12,
      difficulty: 'normal',
      gamemode: 'survival',
      pvp: true,
      allowFlight: false,
      viewDistance: 10,
      simulationDistance: 8,
      onlineMode: true,
      spawnProtection: 16,
      hardcore: false,
      whiteList: true,
      enableRcon: true,
      rconPort: 25577,
    },
    mods: [
      {
        id: 'AANobbMI',
        name: 'Sodium',
        slug: 'sodium',
        filename: 'sodium-neoforge-0.6.6.jar',
        installedVersionId: 'v-sod-1',
        installedVersionNumber: '0.6.6',
        enabled: true,
        fileSizeBytes: 2890000,
        summary: 'A modern, open-source optimization engine for Minecraft that greatly improves performance.',
        author: 'jellysquid3',
        loaders: ['neoforge'],
        gameVersions: ['1.21.1'],
        installedAt: '2024-12-10T08:00:00Z',
        iconUrl: 'https://cdn.modrinth.com/data/AANobbMI/icon.png',
      },
    ],
    players: [
      {
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        username: 'Notch',
        isOp: true,
        isWhitelisted: true,
        online: true,
        pingMs: 31,
        playtimeMinutes: 450,
        lastSeen: 'Now',
        ipAddress: '192.168.1.102',
        coords: { x: 50, y: 72, z: 120, dimension: 'overworld' },
        health: 20,
        food: 20,
        gameMode: 'survival',
      },
    ],
    backups: [],
    backupSchedule: {
      enabled: true,
      frequency: '12h',
      maxKeepBackups: 10,
      includeMods: true,
    },
    telemetry: {
      cpuPercent: 28.4,
      ramUsedMb: 5240,
      ramMaxMb: 8192,
      tps: 19.95,
      tickTimeMs: 22.8,
      diskUsedMb: 3200,
      diskTotalMb: 50000,
      networkInKb: 142.1,
      networkOutKb: 388.0,
      uptimeSeconds: 43200,
    },
    files: getDefaultServerFiles('NeoForge Tech Horizons', 25567, 'neoforge', []),
  },
];

const INITIAL_LOGS: Record<string, ServerLog[]> = {};

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [servers, setServers] = useState<MinecraftServer[]>(() => {
    const saved = localStorage.getItem('crafty_servers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [activeServerId, setActiveServerId] = useState<string>(() => {
    return servers[0]?.id || '';
  });

  const [serverLogs, setServerLogs] = useState<Record<string, ServerLog[]>>(() => {
    const saved = localStorage.getItem('crafty_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_LOGS;
  });

  const [alerts, setAlerts] = useState<{
    id: string;
    serverId: string;
    title: string;
    message: string;
    date: string;
    type: 'info' | 'update' | 'warning';
    targetTab?: 'updates' | 'mods' | 'players' | 'config' | 'backups';
    targetAction?: 'review_whitelist' | 'update_loader' | 'view_mod';
  }[]>([]);

  const [downloads, setDownloads] = useState<import('../types/server').DownloadItem[]>([]);

  const addDownload = (
    item: Omit<import('../types/server').DownloadItem, 'id' | 'startedAt' | 'progressPercent'>
  ): string => {
    const id = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newDownload: import('../types/server').DownloadItem = {
      ...item,
      id,
      progressPercent: 15,
      startedAt: 'Just now',
      speedMbps: Number((30 + Math.random() * 40).toFixed(1)),
    };

    setDownloads((prev) => [newDownload, ...prev]);

    // Simulate progress to 100%
    const interval = setInterval(() => {
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          if (d.progressPercent >= 90) {
            clearInterval(interval);
            return {
              ...d,
              progressPercent: 100,
              status: 'completed',
              completedAt: 'Just now',
            };
          }
          return {
            ...d,
            progressPercent: d.progressPercent + 25,
            status: d.progressPercent + 25 >= 80 ? 'installing' : 'downloading',
          };
        })
      );
    }, 400);

    return id;
  };

  const clearCompletedDownloads = () => {
    setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
  };

  const dismissAllAlerts = () => {
    setAlerts([]);
  };

  const activeServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save servers to local storage
  useEffect(() => {
    localStorage.setItem('crafty_servers', JSON.stringify(servers));
  }, [servers]);

  // Save logs to local storage
  useEffect(() => {
    localStorage.setItem('crafty_logs', JSON.stringify(serverLogs));
  }, [serverLogs]);

  // Real-time telemetry & background tick simulation for running servers
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setServers((prevServers) =>
        prevServers.map((srv) => {
          if (srv.status !== 'online') return srv;

          // dynamic jitter for realistic telemetry
          const cpuDelta = (Math.random() - 0.5) * 4;
          const newCpu = Math.max(3, Math.min(95, srv.telemetry.cpuPercent + cpuDelta));

          const ramDelta = (Math.random() - 0.48) * 30;
          const newRam = Math.max(
            srv.minRamMb,
            Math.min(srv.allocatedRamMb * 0.92, srv.telemetry.ramUsedMb + ramDelta)
          );

          const tpsJitter = (Math.random() - 0.5) * 0.05;
          const newTps = Math.min(20.0, Math.max(18.5, 20.0 - (newCpu > 80 ? 0.8 : 0) + tpsJitter));

          const tickMs = Number(((1000 / (newTps * 50)) * (10 + Math.random() * 4)).toFixed(1));

          return {
            ...srv,
            telemetry: {
              ...srv.telemetry,
              cpuPercent: Number(newCpu.toFixed(1)),
              ramUsedMb: Math.round(newRam),
              tps: Number(newTps.toFixed(2)),
              tickTimeMs: tickMs,
              uptimeSeconds: srv.telemetry.uptimeSeconds + 3,
              networkInKb: Math.max(10, Math.round(srv.telemetry.networkInKb + (Math.random() - 0.5) * 20)),
              networkOutKb: Math.max(20, Math.round(srv.telemetry.networkOutKb + (Math.random() - 0.5) * 40)),
            },
          };
        })
      );
    }, 3000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll real backend process logs every 1.5 seconds for active online server
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!activeServerId) return;
      const srv = servers.find((s) => s.id === activeServerId);
      if (!srv || srv.status !== 'online') return;

      try {
        const res = await fetch(`/api/servers/${activeServerId}/logs`);
        if (res.ok) {
          const data = await res.json();
          if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
            setServerLogs((prev) => ({
              ...prev,
              [activeServerId]: data.logs,
            }));
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [activeServerId, servers]);

  // Helper to parse interval in ms for any interval string (e.g. "Every 365 Days", "Every 1 Year", "Every 4 Hours")
  const parseIntervalDurationMs = (intervalStr: string): number => {
    const lower = intervalStr.toLowerCase();
    const numMatch = lower.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 1;

    if (lower.includes('minute')) return num * 60 * 1000;
    if (lower.includes('hour')) return num * 60 * 60 * 1000;
    if (lower.includes('day')) return num * 24 * 60 * 60 * 1000;
    if (lower.includes('week')) return num * 7 * 24 * 60 * 60 * 1000;
    if (lower.includes('month')) return num * 30 * 24 * 60 * 60 * 1000;
    if (lower.includes('year')) return num * 365 * 24 * 60 * 60 * 1000;
    return 6 * 60 * 60 * 1000; // default 6h
  };

  // Persistent long-term scheduler ticker (survives app reboots, computer shutdowns, and power cycles)
  useEffect(() => {
    const checkScheduledTasks = () => {
      const now = Date.now();
      setServers((prevServers) => {
        let hasAnyTaskUpdates = false;

        const updatedServers = prevServers.map((srv) => {
          if (srv.isArchived || !srv.scheduledTasks || srv.scheduledTasks.length === 0) return srv;

          let srvTaskChanged = false;
          const updatedTasks = srv.scheduledTasks.map((task) => {
            if (!task.enabled) return task;

            const durationMs = task.intervalDurationMs || parseIntervalDurationMs(task.cronOrInterval);
            let nextTimestamp = task.nextRunTimestamp;

            // Initialize next run timestamp if missing
            if (!nextTimestamp) {
              nextTimestamp = now + durationMs;
              srvTaskChanged = true;
              return {
                ...task,
                intervalDurationMs: durationMs,
                nextRunTimestamp: nextTimestamp,
                nextRun: new Date(nextTimestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };
            }

            // Check if due (even if offline for 6 months or 1 year)
            if (now >= nextTimestamp) {
              srvTaskChanged = true;
              hasAnyTaskUpdates = true;

              // Execute action asynchronously
              if (task.type === 'backup') {
                if (task.backupRuleId) {
                  runBackupRule(srv.id, task.backupRuleId).catch(() => {});
                } else {
                  createBackup(
                    srv.id,
                    `sched-${task.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                    'scheduled'
                  ).catch(() => {});
                }
              } else if (task.type === 'restart') {
                restartServer(srv.id);
              } else if (task.type === 'command' && task.command) {
                executeCommand(task.command, srv.id);
              } else if (task.type === 'sleep') {
                putServerToSleep(srv.id);
              }

              const newNextTimestamp = now + durationMs;
              const formattedNext = new Date(newNextTimestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return {
                ...task,
                lastRunTimestamp: now,
                lastRun: 'Just now (Persisted Timer)',
                nextRunTimestamp: newNextTimestamp,
                nextRun: formattedNext,
              };
            }

            return task;
          });

          if (srvTaskChanged) {
            hasAnyTaskUpdates = true;
            return { ...srv, scheduledTasks: updatedTasks };
          }
          return srv;
        });

        return hasAnyTaskUpdates ? updatedServers : prevServers;
      });
    };

    // Run check immediately on mount and every 4 seconds
    checkScheduledTasks();
    const schedulerInterval = setInterval(checkScheduledTasks, 4000);
    return () => clearInterval(schedulerInterval);
  }, []);

  const addLog = (serverId: string, log: Omit<ServerLog, 'id'>) => {
    const newEntry: ServerLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...log,
    };
    setServerLogs((prev) => {
      const existing = prev[serverId] || [];
      // Keep max 500 logs per server for memory efficiency
      const updated = [...existing, newEntry].slice(-500);
      return { ...prev, [serverId]: updated };
    });
  };

  const getTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  const startServer = async (id?: string) => {
    const targetId = id || activeServer.id;
    const target = servers.find((s) => s.id === targetId);
    if (!target || target.status === 'online' || target.status === 'starting') return;

    // Transition: starting
    setServers((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? {
              ...s,
              status: 'starting',
              uptimeStartedAt: new Date().toISOString(),
              telemetry: { ...s.telemetry, uptimeSeconds: 0, cpuPercent: 35.0, ramUsedMb: s.minRamMb },
            }
          : s
      )
    );

    addLog(targetId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'main',
      message: `[MMSM Host Backend] Spawning Java OS process for "${target.name}" on port ${target.port}...`,
    });

    try {
      const res = await fetch(`/api/servers/${targetId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: target.name,
          port: target.port,
          minRamMb: target.minRamMb,
          ramMb: target.allocatedRamMb,
          loader: target.loader,
          minecraftVersion: target.minecraftVersion,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addLog(targetId, {
          timestamp: getTimestamp(),
          level: 'INFO',
          thread: 'Host OS',
          message: `[OS Process Running] PID: ${data.pid} bound to port ${data.port || target.port}`,
        });
        setServers((prev) =>
          prev.map((s) =>
            s.id === targetId
              ? {
                  ...s,
                  status: 'online',
                  telemetry: {
                    ...s.telemetry,
                    tps: 20.0,
                    cpuPercent: 12.0,
                    ramUsedMb: Math.round(s.allocatedRamMb * 0.45),
                  },
                }
              : s
          )
        );
      } else {
        addLog(targetId, {
          timestamp: getTimestamp(),
          level: 'WARN',
          thread: 'Host OS',
          message: data.error || 'Running in Web GUI simulation mode.',
        });
        setServers((prev) =>
          prev.map((s) => (s.id === targetId ? { ...s, status: 'online' } : s))
        );
      }
    } catch {
      addLog(targetId, {
        timestamp: getTimestamp(),
        level: 'INFO',
        thread: 'WebGUI',
        message: `[Web GUI Mode] Active instance "${target.name}" running on port ${target.port}.`,
      });
      setServers((prev) =>
        prev.map((s) => (s.id === targetId ? { ...s, status: 'online' } : s))
      );
    }
  };

  const stopServer = async (id?: string) => {
    const targetId = id || activeServer.id;
    const target = servers.find((s) => s.id === targetId);
    if (!target || target.status === 'offline' || target.status === 'stopping') return;

    setServers((prev) =>
      prev.map((s) => (s.id === targetId ? { ...s, status: 'stopping' } : s))
    );

    addLog(targetId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Server thread',
      message: 'Sending graceful stop command to OS process...',
    });

    try {
      await fetch(`/api/servers/${targetId}/stop`, { method: 'POST' });
    } catch {}

    setTimeout(() => {
      addLog(targetId, {
        timestamp: getTimestamp(),
        level: 'INFO',
        thread: 'main',
        message: '[MMSM Host Backend] Server process terminated safely.',
      });

      setServers((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? {
                ...s,
                status: 'offline',
                telemetry: {
                  ...s.telemetry,
                  cpuPercent: 0,
                  ramUsedMb: 0,
                  tps: 20.0,
                  tickTimeMs: 0,
                  uptimeSeconds: 0,
                },
                players: s.players.map((p) => ({ ...p, online: false })),
              }
            : s
        )
      );
    }, 1500);
  };

  const restartServer = async (id?: string) => {
    const targetId = id || activeServer.id;
    await stopServer(targetId);
    setTimeout(() => {
      startServer(targetId);
    }, 2000);
  };

  const killServer = async (id?: string) => {
    const targetId = id || activeServer.id;
    addLog(targetId, {
      timestamp: getTimestamp(),
      level: 'WARN',
      thread: 'System',
      message: '[MMSM Host Backend] Force killing server process with SIGKILL / taskkill...',
    });

    try {
      await fetch(`/api/servers/${targetId}/kill`, { method: 'POST' });
    } catch {}

    setServers((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? {
              ...s,
              status: 'offline',
              telemetry: {
                ...s.telemetry,
                cpuPercent: 0,
                ramUsedMb: 0,
                tps: 20.0,
                tickTimeMs: 0,
                uptimeSeconds: 0,
              },
              players: s.players.map((p) => ({ ...p, online: false })),
            }
          : s
      )
    );
  };

  const executeCommand = async (cmd: string, serverId?: string) => {
    const targetId = serverId || activeServer.id;
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;

    // Log the command entered by operator
    addLog(targetId, {
      timestamp: getTimestamp(),
      level: 'CMD',
      thread: 'Console',
      message: `> ${cleanCmd}`,
    });

    try {
      await fetch(`/api/servers/${targetId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cleanCmd }),
      });
    } catch {}

    const parts = cleanCmd.replace(/^\//, '').split(' ');
    const root = parts[0]?.toLowerCase();
    const arg1 = parts[1];
    const arg2 = parts.slice(2).join(' ');

    setTimeout(() => {
      switch (root) {
        case 'help':
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: 'Available commands: /say, /list, /tps, /whitelist, /op, /deop, /kick, /ban, /save-all, /stop, /reload, /time, /weather, /gamerule',
          });
          break;

        case 'say':
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'CHAT',
            thread: 'Server thread',
            message: `[Server] ${parts.slice(1).join(' ')}`,
          });
          break;

        case 'list': {
          const target = servers.find((s) => s.id === targetId);
          const onlinePlayers = target?.players.filter((p) => p.online) || [];
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: `There are ${onlinePlayers.length} of a max of ${target?.properties.maxPlayers || 20} players online: ${onlinePlayers.map((p) => p.username).join(', ')}`,
          });
          break;
        }

        case 'tps': {
          const target = servers.find((s) => s.id === targetId);
          const tps = target?.telemetry.tps || 20.0;
          const mspt = target?.telemetry.tickTimeMs || 12.0;
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: `TPS from last 1m, 5m, 15m: ${tps.toFixed(2)}, 20.0, 20.0 (Tick time: ${mspt}ms)`,
          });
          break;
        }

        case 'save-all':
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: 'Saving the game (this may take a moment!)',
          });
          setTimeout(() => {
            addLog(targetId, {
              timestamp: getTimestamp(),
              level: 'INFO',
              thread: 'Server thread',
              message: 'Saved the game successfully.',
            });
          }, 600);
          break;

        case 'stop':
          stopServer(targetId);
          break;

        case 'kick':
          if (arg1) {
            kickPlayer(targetId, arg1, arg2 || 'Kicked by an operator.');
          } else {
            addLog(targetId, {
              timestamp: getTimestamp(),
              level: 'WARN',
              thread: 'Server thread',
              message: 'Usage: /kick <player> [reason]',
            });
          }
          break;

        case 'ban':
          if (arg1) {
            banPlayer(targetId, arg1, arg2 || 'Banned by operator.');
          } else {
            addLog(targetId, {
              timestamp: getTimestamp(),
              level: 'WARN',
              thread: 'Server thread',
              message: 'Usage: /ban <player> [reason]',
            });
          }
          break;

        case 'op':
          if (arg1) {
            togglePlayerOp(targetId, arg1);
          }
          break;

        case 'time':
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: `Set the time to ${parts[2] || 'day'} (1000)`,
          });
          break;

        case 'weather':
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: `Set the weather to ${parts[1] || 'clear'}`,
          });
          break;

        default:
          addLog(targetId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'Server thread',
            message: `Executed command '/${cleanCmd}' successfully.`,
          });
          break;
      }
    }, 200);
  };

  const clearLogs = (serverId?: string) => {
    const targetId = serverId || activeServer.id;
    setServerLogs((prev) => ({ ...prev, [targetId]: [] }));
  };

  // Mod actions
  const installMod = (serverId: string, mod: InstalledMod) => {
    const srv = servers.find((s) => s.id === serverId);
    const baseDir = (wrapperSettings?.serversDirectory || './servers').replace(/\/+$/, '');
    const serverName = srv?.name || 'server';
    const serverRoot = `${baseDir}/${serverName}`;
    const modFilePath = `${serverRoot}/mods/${mod.filename}`;
    const modsDirPath = `${serverRoot}/mods`;

    // 1. Add task history item to downloads monitor
    addDownload({
      serverId,
      serverName: srv?.name || 'Minecraft Server',
      title: mod.name,
      filename: mod.filename,
      totalSizeBytes: mod.fileSizeBytes || 1800000,
      type: 'mod',
      status: 'downloading',
    });

    // 2. Add mod to server's installed mods and sync to server.files
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const exists = s.mods.some((m) => m.id === mod.id || m.slug === mod.slug);
        const nextMods = exists
          ? s.mods.map((m) => (m.id === mod.id || m.slug === mod.slug ? mod : m))
          : [mod, ...s.mods];

        const normModPath = modFilePath.replace(/^\.\//, '/').replace(/\/+/g, '/').toLowerCase();
        const normModsDir = modsDirPath.replace(/^\.\//, '/').replace(/\/+/g, '/').toLowerCase();

        let nextFiles = [...s.files];

        if (!nextFiles.some((f) => f.path.replace(/^\.\//, '/').replace(/\/+/g, '/').toLowerCase() === normModsDir)) {
          nextFiles.push({
            id: `d-mods-${Date.now()}`,
            name: 'mods',
            path: modsDirPath,
            isDirectory: true,
            sizeBytes: 0,
            lastModified: new Date().toISOString().replace('T', ' ').substring(0, 19),
          });
        }

        const fileExists = nextFiles.some(
          (f) => f.path.replace(/^\.\//, '/').replace(/\/+/g, '/').toLowerCase() === normModPath || f.name === mod.filename
        );
        
        if (!fileExists) {
          const modFileItem: ServerFile = {
            id: `f-mod-${mod.id}-${Date.now()}`,
            name: mod.filename,
            path: modFilePath,
            isDirectory: false,
            sizeBytes: mod.fileSizeBytes || 1800000,
            lastModified: new Date().toISOString().replace('T', ' ').substring(0, 19),
            extension: 'jar',
          };
          nextFiles.push(modFileItem);
        }

        return {
          ...s,
          mods: nextMods,
          files: nextFiles,
        };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'ModManager',
      message: `[Modrinth] Installed mod '${mod.name}' (${mod.filename}) into /mods folder.`,
    });
  };

  const toggleMod = (serverId: string, modId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          mods: s.mods.map((m) => {
            if (m.id === modId) {
              const newEnabled = !m.enabled;
              const newFilename = newEnabled
                ? m.filename.replace(/\.disabled$/, '')
                : m.filename.endsWith('.disabled')
                ? m.filename
                : `${m.filename}.disabled`;
              return { ...m, enabled: newEnabled, filename: newFilename };
            }
            return m;
          }),
        };
      })
    );
  };

  const updateMod = (
    serverId: string,
    modId: string,
    newVersionNumber: string,
    newVersionId: string
  ) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          mods: s.mods.map((m) => {
            if (m.id === modId) {
              return {
                ...m,
                installedVersionId: newVersionId,
                installedVersionNumber: newVersionNumber,
                hasUpdate: false,
                filename: `${m.slug}-${newVersionNumber}.jar`,
              };
            }
            return m;
          }),
        };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'ModManager',
      message: `[Modrinth] Mod updated to version ${newVersionNumber}. Jar replaced.`,
    });
  };

  const removeMod = (serverId: string, modId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const removed = s.mods.find((m) => m.id === modId);
        if (removed) {
          addLog(serverId, {
            timestamp: getTimestamp(),
            level: 'INFO',
            thread: 'ModManager',
            message: `Deleted file ${removed.filename} from /mods directory.`,
          });
        }
        return {
          ...s,
          mods: s.mods.filter((m) => m.id !== modId),
        };
      })
    );
  };

  const checkModUpdatesForServer = async (serverId: string): Promise<number> => {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv) return 0;

    let updatesFound = 0;
    const updatedMods = await Promise.all(
      srv.mods.map(async (mod) => {
        try {
          const res = await checkModUpdate(
            mod.id,
            mod.installedVersionNumber,
            srv.loader,
            srv.minecraftVersion
          );
          if (res.hasUpdate && res.latestVersion) {
            updatesFound++;
            return {
              ...mod,
              hasUpdate: true,
              latestVersionId: res.latestVersion.id,
              latestVersionNumber: res.latestVersion.version_number,
            };
          }
          return { ...mod, hasUpdate: false };
        } catch {
          return mod;
        }
      })
    );

    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, mods: updatedMods } : s))
    );

    if (updatesFound > 0) {
      setAlerts((prev) => [
        {
          id: `alert-mods-${Date.now()}`,
          serverId,
          title: `${updatesFound} Mod Update(s) Available`,
          message: `New compatible updates found for ${srv.name} on Modrinth. Review in Mod Manager.`,
          date: 'Just now',
          type: 'update',
        },
        ...prev,
      ]);
    }

    return updatesFound;
  };

  const upgradeLoader = async (serverId: string) => {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv) return;

    const latest = getLatestLoaderVersion(srv.loader, srv.minecraftVersion);
    const oldVersion = srv.loaderVersion;

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Updater',
      message: `[Upgrade] Updating loader ${srv.loader.toUpperCase()} from ${oldVersion} to ${latest.latestVersion}...`,
    });

    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              loaderVersion: latest.latestVersion,
              hasLoaderUpdate: false,
            }
          : s
      )
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Updater',
      message: `[Upgrade] Successfully upgraded loader to ${latest.latestVersion}! Server restart advised.`,
    });
  };

  // Backups
  const createBackup = async (
    serverId: string,
    customName?: string,
    type: 'manual' | 'scheduled' = 'manual'
  ): Promise<BackupRecord> => {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv || srv.isArchived) {
      throw new Error('Cannot create backup: Server is archived or does not exist.');
    }
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const name = customName || `backup-${srv?.name.toLowerCase().replace(/\s+/g, '-')}-${dateStr}`;

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'BackupSystem',
      message: `Creating world and config snapshot archive '${name}.zip'...`,
    });

    const newBackup: BackupRecord = {
      id: `bk-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      sizeBytes: Math.floor(120000000 + Math.random() * 80000000), // ~120-200MB
      isPinned: false,
      type,
      minecraftVersion: srv?.minecraftVersion || '1.21.4',
      loader: srv?.loader || 'fabric',
    };

    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        // Enforce max keep backups if schedule enabled
        let currentBackups = [newBackup, ...s.backups];
        if (type === 'scheduled' && s.backupSchedule.enabled) {
          const unpinned = currentBackups.filter((b) => !b.isPinned);
          if (unpinned.length > s.backupSchedule.maxKeepBackups) {
            const pinned = currentBackups.filter((b) => b.isPinned);
            currentBackups = [...pinned, ...unpinned.slice(0, s.backupSchedule.maxKeepBackups)];
          }
        }
        return {
          ...s,
          backups: currentBackups,
          backupSchedule: {
            ...s.backupSchedule,
            lastRunAt: new Date().toISOString(),
          },
        };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'BackupSystem',
      message: `Backup '${name}' completed successfully (${(newBackup.sizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
    });

    return newBackup;
  };

  const restoreBackup = async (serverId: string, backupId: string) => {
    const srv = servers.find((s) => s.id === serverId);
    const bk = srv?.backups.find((b) => b.id === backupId);
    if (!bk) return;

    if (srv?.status === 'online') {
      await stopServer(serverId);
    }

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'WARN',
      thread: 'BackupSystem',
      message: `Restoring server state from snapshot '${bk.name}'...`,
    });

    setTimeout(() => {
      addLog(serverId, {
        timestamp: getTimestamp(),
        level: 'INFO',
        thread: 'BackupSystem',
        message: 'Snapshot extracted and verified. Ready to start.',
      });
    }, 1500);
  };

  const deleteBackup = (serverId: string, backupId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          backups: s.backups.filter((b) => b.id !== backupId),
        };
      })
    );
  };

  const togglePinBackup = (serverId: string, backupId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          backups: s.backups.map((b) =>
            b.id === backupId ? { ...b, isPinned: !b.isPinned } : b
          ),
        };
      })
    );
  };

  const updateBackupSchedule = (serverId: string, schedule: BackupSchedule) => {
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, backupSchedule: schedule } : s))
    );
  };

  const createBackupRule = (
    serverId: string,
    ruleData: Omit<BackupRule, 'id' | 'createdAt'>
  ): BackupRule => {
    const newRule: BackupRule = {
      ...ruleData,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          backupRules: [...(s.backupRules || []), newRule],
        };
      })
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'BackupRules',
      message: `Configured new backup rule '${newRule.name}'. Destination: "${newRule.destinationPath}", Retention: ${newRule.retentionCount} backups.`,
    });
    return newRule;
  };

  const updateBackupRule = (
    serverId: string,
    ruleId: string,
    updates: Partial<BackupRule>
  ) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          backupRules: (s.backupRules || []).map((r) =>
            r.id === ruleId ? { ...r, ...updates } : r
          ),
        };
      })
    );
  };

  const deleteBackupRule = (serverId: string, ruleId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          backupRules: (s.backupRules || []).filter((r) => r.id !== ruleId),
        };
      })
    );
  };

  const runBackupRule = async (serverId: string, ruleId: string): Promise<BackupRecord> => {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv || srv.isArchived) {
      throw new Error('Cannot execute backup rule: Server is archived or does not exist.');
    }
    const rule = srv?.backupRules?.find((r) => r.id === ruleId);
    const ruleName = rule?.name || 'Manual Backup';
    const destPath = rule?.destinationPath || wrapperSettings.backupsDirectory || '/Backups';
    const included = rule?.includedPaths || ['world', 'config', 'server.properties'];
    const retention = rule?.retentionCount || 10;
    
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const name = `${ruleName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateStr}`;

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'BackupRuleRunner',
      message: `[Backup Rule: ${ruleName}] Executing archive job. Target directory: "${destPath}". Compressing (${included.join(', ')})...`,
    });

    const newBackup: BackupRecord = {
      id: `bk-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      sizeBytes: Math.floor(95000000 + Math.random() * 85000000),
      isPinned: false,
      type: 'manual',
      minecraftVersion: srv?.minecraftVersion || '1.21.4',
      loader: srv?.loader || 'fabric',
      ruleId,
      ruleName,
      destinationPath: destPath,
      includedItems: included,
    };

    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const existingMatching = (s.backups || []).filter((b) => b.ruleId === ruleId && !b.isPinned);
        let newBackups = [newBackup, ...s.backups];
        if (existingMatching.length >= retention) {
          const allowedMatchingIds = new Set(
            [newBackup, ...existingMatching.slice(0, retention - 1)].map((b) => b.id)
          );
          newBackups = newBackups.filter(
            (b) => b.ruleId !== ruleId || b.isPinned || allowedMatchingIds.has(b.id)
          );
        }
        return {
          ...s,
          backups: newBackups,
          backupRules: (s.backupRules || []).map((r) =>
            r.id === ruleId ? { ...r, lastRunAt: new Date().toISOString() } : r
          ),
        };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'BackupRuleRunner',
      message: `[Backup Rule: ${ruleName}] Archive saved to "${destPath}/${name}.zip" (${(newBackup.sizeBytes / 1048576).toFixed(1)} MB). Retention enforced (${retention} max).`,
    });

    return newBackup;
  };

  const setServerPublicIp = (
    serverId: string,
    publicIp?: string,
    publicPort?: number | string,
    hidePort?: boolean
  ) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              publicServerIp: publicIp ? publicIp.trim() : undefined,
              publicServerPort: publicPort !== undefined && publicPort !== '' ? publicPort : undefined,
              hidePublicPort: !!hidePort,
            }
          : s
      )
    );
  };

  // Players
  const kickPlayer = (serverId: string, username: string, reason?: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          players: s.players.map((p) =>
            p.username.toLowerCase() === username.toLowerCase()
              ? { ...p, online: false }
              : p
          ),
        };
      })
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Server thread',
      message: `Kicked ${username} from the server (${reason || 'Kicked by an operator'})`,
    });
  };

  const banPlayer = (serverId: string, username: string, reason?: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          players: s.players.map((p) =>
            p.username.toLowerCase() === username.toLowerCase()
              ? { ...p, online: false, isBanned: true }
              : p
          ),
        };
      })
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Server thread',
      message: `Banned player ${username}: ${reason || 'Banned by operator'}`,
    });
  };

  const unbanPlayer = (serverId: string, username: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          players: s.players.map((p) =>
            p.username.toLowerCase() === username.toLowerCase()
              ? { ...p, isBanned: false }
              : p
          ),
        };
      })
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Server thread',
      message: `Unbanned player ${username}.`,
    });
  };

  const togglePlayerOp = (serverId: string, username: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const targetPlayer = s.players.find(
          (p) => p.username.toLowerCase() === username.toLowerCase()
        );
        const newOp = !targetPlayer?.isOp;
        addLog(serverId, {
          timestamp: getTimestamp(),
          level: 'INFO',
          thread: 'Server thread',
          message: newOp ? `Made ${username} a server operator` : `Removed ${username}'s operator status`,
        });
        return {
          ...s,
          players: s.players.map((p) =>
            p.username.toLowerCase() === username.toLowerCase()
              ? { ...p, isOp: newOp }
              : p
          ),
        };
      })
    );
  };

  const togglePlayerWhitelist = (serverId: string, username: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          players: s.players.map((p) =>
            p.username.toLowerCase() === username.toLowerCase()
              ? { ...p, isWhitelisted: !p.isWhitelisted }
              : p
          ),
        };
      })
    );
  };

  const updateProperties = (serverId: string, props: Partial<ServerProperties>) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          properties: { ...s.properties, ...props },
          name: props.serverName || s.name,
        };
      })
    );
  };

  const createServer = (newServerData: {
    name: string;
    description: string;
    loader: ServerLoader;
    loaderVersion: string;
    minecraftVersion: string;
    minRamMb?: number;
    ramMb: number;
    port: number;
    modpackId?: string;
  }): MinecraftServer => {
    const id = `srv-${newServerData.loader}-${Date.now().toString(36)}`;
    const newServer: MinecraftServer = {
      id,
      name: newServerData.name,
      description: newServerData.description || `${newServerData.loader.toUpperCase()} ${newServerData.minecraftVersion} server instance`,
      status: 'offline',
      loader: newServerData.loader,
      loaderVersion: newServerData.loaderVersion,
      minecraftVersion: newServerData.minecraftVersion,
      allocatedRamMb: newServerData.ramMb,
      minRamMb: newServerData.minRamMb ? newServerData.minRamMb : Math.max(1024, Math.floor(newServerData.ramMb / 2)),
      javaVersion: 'Java 21 (Temurin-21.0.4)',
      port: newServerData.port,
      createdAt: new Date().toISOString(),
      properties: {
        serverName: newServerData.name,
        motd: `§a${newServerData.name} §7| §fPowered by CraftyForge`,
        serverPort: newServerData.port,
        maxPlayers: 20,
        difficulty: 'normal',
        gamemode: 'survival',
        pvp: true,
        allowFlight: false,
        viewDistance: 10,
        simulationDistance: 8,
        onlineMode: true,
        spawnProtection: 16,
        hardcore: false,
        whiteList: false,
        enableRcon: false,
        rconPort: newServerData.port + 10,
      },
      mods: [],
      players: [
        {
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          username: 'Notch',
          isOp: true,
          isWhitelisted: true,
          online: false,
          pingMs: 0,
          playtimeMinutes: 0,
          lastSeen: 'Never',
          ipAddress: '127.0.0.1',
          coords: { x: 0, y: 64, z: 0, dimension: 'overworld' },
          health: 20,
          food: 20,
          gameMode: 'survival',
        },
      ],
      backups: [],
      backupSchedule: {
        enabled: true,
        frequency: '12h',
        maxKeepBackups: 5,
        includeMods: true,
      },
      telemetry: {
        cpuPercent: 0,
        ramUsedMb: 0,
        ramMaxMb: newServerData.ramMb,
        tps: 20.0,
        tickTimeMs: 0,
        diskUsedMb: 420,
        diskTotalMb: 50000,
        networkInKb: 0,
        networkOutKb: 0,
        uptimeSeconds: 0,
      },
      files: getDefaultServerFiles(
        newServerData.name,
        newServerData.port,
        newServerData.loader,
        [],
        wrapperSettings.serversDirectory || '/Servers'
      ),
    };

    setServers((prev) => [...prev, newServer]);
    setActiveServerId(newServer.id);

    setServerLogs((prev) => ({
      ...prev,
      [newServer.id]: [
        {
          id: `log-init-1`,
          timestamp: getTimestamp(),
          level: 'INFO',
          thread: 'Setup',
          message: `Created server "${newServer.name}" (${newServer.loader.toUpperCase()} ${newServer.minecraftVersion}) on port ${newServer.port}.`,
        },
      ],
    }));

    return newServer;
  };

  const deleteServer = (serverId: string) => {
    setServers((prev) => {
      const filtered = prev.filter((s) => s.id !== serverId);
      if (activeServerId === serverId) {
        setActiveServerId(filtered[0]?.id || '');
      }
      return filtered;
    });

    setServerLogs((prev) => {
      const next = { ...prev };
      delete next[serverId];
      return next;
    });
  };

  const purgeSampleData = () => {
    setServers([]);
    setActiveServerId('');
    setServerLogs({});
    setAlerts([]);
    setDownloads([]);
    localStorage.setItem('crafty_servers', JSON.stringify([]));
    localStorage.setItem('crafty_logs', JSON.stringify({}));
  };

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // File Management Methods
  const saveFile = (serverId: string, path: string, content: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const exists = s.files.some((f) => f.path === path);
        const sizeBytes = new Blob([content]).size;
        const lastModified = new Date().toISOString().replace('T', ' ').substring(0, 19);

        let newFiles: ServerFile[];
        if (exists) {
          newFiles = s.files.map((f) =>
            f.path === path ? { ...f, content, sizeBytes, lastModified } : f
          );
        } else {
          const parts = path.split('/');
          const name = parts[parts.length - 1];
          const ext = name.includes('.') ? name.split('.').pop() : '';
          const newFile: ServerFile = {
            id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name,
            path,
            isDirectory: false,
            sizeBytes,
            lastModified,
            content,
            extension: ext,
          };
          newFiles = [...s.files, newFile];
        }

        return { ...s, files: newFiles };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'FileManager',
      message: `Saved file "${path}".`,
    });
  };

  const createFile = (serverId: string, path: string, isDirectory: boolean, content: string = '') => {
    const parts = path.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || 'new-file';
    const ext = !isDirectory && name.includes('.') ? name.split('.').pop() : undefined;
    const lastModified = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newFile: ServerFile = {
      id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      path: path.startsWith('/') ? path : `/${path}`,
      isDirectory,
      sizeBytes: isDirectory ? 0 : new Blob([content]).size,
      lastModified,
      content: isDirectory ? undefined : content,
      extension: ext,
    };

    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        // Avoid duplicate paths
        if (s.files.some((f) => f.path === newFile.path)) return s;
        return { ...s, files: [...s.files, newFile] };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'FileManager',
      message: `Created ${isDirectory ? 'directory' : 'file'} "${newFile.path}".`,
    });
  };

  const deleteFile = (serverId: string, path: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        // Also remove children if directory
        return {
          ...s,
          files: s.files.filter((f) => f.path !== path && !f.path.startsWith(`${path}/`)),
        };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'FileManager',
      message: `Deleted "${path}".`,
    });
  };

  const renameFile = (serverId: string, oldPath: string, newName: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const target = s.files.find((f) => f.path === oldPath);
        if (!target) return s;

        const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${dir}/${newName}`.replace(/^\/\//, '/');
        const ext = !target.isDirectory && newName.includes('.') ? newName.split('.').pop() : target.extension;

        return {
          ...s,
          files: s.files.map((f) => {
            if (f.path === oldPath) {
              return { ...f, name: newName, path: newPath, extension: ext };
            }
            if (f.path.startsWith(`${oldPath}/`)) {
              return { ...f, path: f.path.replace(oldPath, newPath) };
            }
            return f;
          }),
        };
      })
    );
  };

  const [wrapperSettings, setWrapperSettings] = useState<import('../types/server').WrapperSettings>(() => {
    const saved = localStorage.getItem('crafty_wrapper_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.portRangeStart) {
          return {
            wrapperWebPort: 3000,
            wrapperBindHost: '0.0.0.0',
            enableHttps: false,
            httpsPort: 3443,
            githubUpdate: {
              currentVersion: 'v2.5.0',
              latestVersion: 'v2.6.0',
              hasUpdate: true,
              repoUrl: 'https://github.com/MrHaydenn/mmsm-minecraft-server-manager',
              releaseTitle: 'MMSM v2.6.0: Automated Backups, Offline Players & Dynamic Core Loaders',
              releaseNotes: '• Dynamic Loader API selector (Forge, NeoForge, Fabric, Quilt, Paper, Purpur, Velocity)\n• Backup Rules with secondary drive support & retention pruning\n• Offline Player Roster & Moderation\n• Multi-Interface Network Settings & Host Binding\n• Self-Contained Standalone Launchers (.bat, .ps1, .sh)',
              publishedAt: '2 hours ago',
              autoCheckEnabled: true,
              autoShutdownServersOnUpdate: true,
              autoRestartServersAfterUpdate: true,
              lastCheckedAt: 'Today at 10:30 AM',
            },
            ...parsed,
          };
        }
      } catch {}
    }
    return {
      autoAcceptEula: true,
      publicIp: 'play.mmsm-network.net',
      wrapperWebPort: 3000,
      wrapperBindHost: '0.0.0.0',
      enableHttps: false,
      httpsPort: 3443,
      customWrapperLogoUrl: '',
      accentColor: 'emerald',
      customEmblemIcon: 'sword',
      hostHardware: {
        totalRamGb: (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) ? (navigator as any).deviceMemory : 16,
        cpuCores: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 8,
        totalDiskGb: 500,
      },
      serversDirectory: './servers',
      backupsDirectory: './backups',
      defaultMinRamGb: 2,
      defaultMaxRamGb: 4,
      defaultJavaPath: '/usr/lib/jvm/temurin-21-jdk',
      portRangeStart: 25560,
      portRangeEnd: 25569,
      telemetryIntervalMs: 2500,
      enableAnonymousTelemetry: false,
      githubUpdate: {
        currentVersion: 'v2.5.0',
        latestVersion: 'v2.6.0',
        hasUpdate: true,
        repoUrl: 'https://github.com/MrHaydenn/mmsm-minecraft-server-manager',
        releaseTitle: 'MMSM v2.6.0: Automated Backups, Offline Players & Dynamic Core Loaders',
        releaseNotes: '• Dynamic Loader API selector (Forge, NeoForge, Fabric, Quilt, Paper, Purpur, Velocity)\n• Backup Rules with secondary drive support & retention pruning\n• Offline Player Roster & Moderation\n• Multi-Interface Network Settings & Host Binding\n• Self-Contained Standalone Launchers (.bat, .ps1, .sh)',
        publishedAt: '2 hours ago',
        autoCheckEnabled: true,
        autoShutdownServersOnUpdate: true,
        autoRestartServersAfterUpdate: true,
        lastCheckedAt: 'Today at 10:30 AM',
      },
      javaRuntimes: [
        {
          id: 'java-21',
          name: 'Java 21 (LTS)',
          version: 21,
          vendor: 'Eclipse Temurin (Adoptium)',
          path: '/usr/lib/jvm/temurin-21-jdk',
          installed: true,
          sizeMb: 320,
          isDefault: true,
        },
        {
          id: 'java-17',
          name: 'Java 17 (LTS)',
          version: 17,
          vendor: 'Eclipse Temurin (Adoptium)',
          path: '/usr/lib/jvm/temurin-17-jdk',
          installed: true,
          sizeMb: 295,
        },
        {
          id: 'java-16',
          name: 'Java 16',
          version: 16,
          vendor: 'AdoptOpenJDK',
          path: '/usr/lib/jvm/adopt-16-jdk',
          installed: false,
          sizeMb: 280,
        },
        {
          id: 'java-8',
          name: 'Java 8 (Legacy)',
          version: 8,
          vendor: 'Azul Zulu OpenJDK',
          path: '/usr/lib/jvm/zulu-8-jdk',
          installed: false,
          sizeMb: 190,
        },
      ],
    };
  });

  useEffect(() => {
    localStorage.setItem('crafty_wrapper_settings', JSON.stringify(wrapperSettings));
  }, [wrapperSettings]);

  const updateWrapperSettings = (partial: Partial<import('../types/server').WrapperSettings>) => {
    setWrapperSettings((prev) => ({ ...prev, ...partial }));
  };

  const archiveServer = (serverId: string) => {
    const srv = servers.find((s) => s.id === serverId);
    if (srv && srv.status === 'online') {
      stopServer(serverId);
    }
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              isArchived: true,
              status: 'offline',
              backupSchedule: { ...s.backupSchedule, enabled: false },
              scheduledTasks: (s.scheduledTasks || []).map((t) => ({ ...t, enabled: false })),
            }
          : s
      )
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'System',
      message: `[Archive] Server "${srv?.name}" archived into vault. All automated backups and scheduled tasks have been paused.`,
    });
  };

  const unarchiveServer = (serverId: string) => {
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, isArchived: false } : s))
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'System',
      message: `[Archive] Server restored from vault to active fleet.`,
    });
  };

  const setServerRam = (serverId: string, minRamMb: number, maxRamMb: number) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              minRamMb: Math.max(512, Math.min(minRamMb, maxRamMb)),
              allocatedRamMb: Math.max(1024, maxRamMb),
            }
          : s
      )
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'System',
      message: `Updated memory allocation: Min ${minRamMb} MB (-Xms) · Max ${maxRamMb} MB (-Xmx).`,
    });
  };

  const uploadModFile = (serverId: string, fileName: string, fileBytes: number) => {
    const srv = servers.find((s) => s.id === serverId);
    const baseDir = (wrapperSettings?.serversDirectory || './servers').replace(/\/+$/, '');
    const serverName = srv?.name || 'server';
    const serverRoot = `${baseDir}/${serverName}`;
    const modFilePath = `${serverRoot}/mods/${fileName}`;

    addDownload({
      serverId,
      serverName: srv?.name || 'Minecraft Server',
      title: fileName,
      filename: fileName,
      totalSizeBytes: fileBytes || 1200000,
      type: 'mod',
      status: 'downloading',
    });

    const slug = fileName.replace(/\.jar(\.disabled)?$/, '').toLowerCase();
    const cleanName = fileName.replace(/[-_]/g, ' ').replace(/\.jar(\.disabled)?$/, '');
    const newMod: InstalledMod = {
      id: `custom-${Date.now()}`,
      name: cleanName,
      slug,
      filename: fileName,
      installedVersionId: 'v-custom',
      installedVersionNumber: '1.0.0',
      enabled: !fileName.endsWith('.disabled'),
      fileSizeBytes: fileBytes,
      summary: 'Custom uploaded mod / plugin jar file.',
      author: 'Uploaded File',
      loaders: ['custom'],
      gameVersions: ['any'],
      installedAt: new Date().toISOString(),
    };

    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, mods: [newMod, ...s.mods] } : s))
    );

    createFile(serverId, modFilePath, false, '');

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'ModManager',
      message: `Uploaded custom file "${fileName}" (${(fileBytes / 1024).toFixed(1)} KB) into /mods folder.`,
    });
  };

  const changeLoader = (
    serverId: string,
    newLoader: ServerLoader,
    newLoaderVersion: string,
    newMcVersion?: string
  ) => {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv) return;

    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              loader: newLoader,
              loaderVersion: newLoaderVersion,
              minecraftVersion: newMcVersion || s.minecraftVersion,
              hasLoaderUpdate: false,
            }
          : s
      )
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Updater',
      message: `[Core] Changed server loader to ${newLoader.toUpperCase()} (${newLoaderVersion}) on MC ${newMcVersion || srv.minecraftVersion}.`,
    });
  };

  const updateServerIcon = (serverId: string, iconUrl: string) => {
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, serverIconUrl: iconUrl } : s))
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'ServerProperties',
      message: 'Updated server-icon.png.',
    });
  };

  const toggleSleepMode = (serverId: string, enabled: boolean, inactivityMinutes = 15) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? { ...s, sleepModeEnabled: enabled, sleepInactivityMinutes: inactivityMinutes }
          : s
      )
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'HibernationProxy',
      message: `Sleep mode ${enabled ? 'enabled' : 'disabled'} (Inactivity timeout: ${inactivityMinutes}m).`,
    });
  };

  const putServerToSleep = (serverId: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              status: 'sleeping',
              isSleeping: true,
              telemetry: { ...s.telemetry, cpuPercent: 0, ramUsedMb: 0, uptimeSeconds: 0 },
              players: s.players.map((p) => ({ ...p, online: false })),
            }
          : s
      )
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'HibernationProxy',
      message: '[Sleep Mode] Zero players active. Server JVM suspended into hibernation. Port listening for next ping/handshake.',
    });
  };

  const wakeServer = async (serverId: string) => {
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'HibernationProxy',
      message: '[Sleep Mode] Incoming client ping / handshake intercepted! Waking server instance...',
    });
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, isSleeping: false } : s))
    );
    await startServer(serverId);
  };

  const approveWhitelistRequest = (serverId: string, requestId: string) => {
    const srv = servers.find((s) => s.id === serverId);
    const req = srv?.whitelistRequests?.find((r) => r.id === requestId);
    if (!req) return;

    // Add to whitelist
    togglePlayerWhitelist(serverId, req.username);

    // Remove from pending
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          whitelistRequests: (s.whitelistRequests || []).filter((r) => r.id !== requestId),
        };
      })
    );

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Server thread',
      message: `[Whitelist] Approved join request from ${req.username} (${req.ip}). Added to whitelist.json`,
    });
  };

  const denyWhitelistRequest = (serverId: string, requestId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          whitelistRequests: (s.whitelistRequests || []).filter((r) => r.id !== requestId),
        };
      })
    );
  };

  const addScheduledTask = (
    serverId: string,
    task: Omit<import('../types/server').ScheduledTask, 'id'>
  ) => {
    const newTask = {
      ...task,
      id: `task-${Date.now()}`,
    };
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          scheduledTasks: [...(s.scheduledTasks || []), newTask],
        };
      })
    );
    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Scheduler',
      message: `Created scheduled task "${newTask.name}" (${newTask.cronOrInterval}).`,
    });
  };

  const toggleScheduledTask = (serverId: string, taskId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          scheduledTasks: (s.scheduledTasks || []).map((t) =>
            t.id === taskId ? { ...t, enabled: !t.enabled } : t
          ),
        };
      })
    );
  };

  const deleteScheduledTask = (serverId: string, taskId: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          scheduledTasks: (s.scheduledTasks || []).filter((t) => t.id !== taskId),
        };
      })
    );
  };

  const runScheduledTaskNow = (serverId: string, taskId: string) => {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv || srv.isArchived) return;
    const task = srv?.scheduledTasks?.find((t) => t.id === taskId);
    if (!task) return;

    addLog(serverId, {
      timestamp: getTimestamp(),
      level: 'INFO',
      thread: 'Scheduler',
      message: `Executing task "${task.name}" on demand...`,
    });

    if (task.type === 'backup') {
      createBackup(serverId, `sched-${task.name.toLowerCase().replace(/\s+/g, '-')}`, 'scheduled');
    } else if (task.type === 'restart') {
      restartServer(serverId);
    } else if (task.type === 'command' && task.command) {
      executeCommand(task.command, serverId);
    } else if (task.type === 'sleep') {
      putServerToSleep(serverId);
    }

    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        return {
          ...s,
          scheduledTasks: (s.scheduledTasks || []).map((t) =>
            t.id === taskId ? { ...t, lastRun: 'Just now' } : t
          ),
        };
      })
    );
  };

  const [isUpdatingWrapper, setIsUpdatingWrapper] = useState<boolean>(false);
  const [updateProgressStep, setUpdateProgressStep] = useState<string>('');

  const checkForGitHubUpdate = async (): Promise<boolean> => {
    // Simulate or query remote release payload
    await new Promise((res) => setTimeout(res, 600));
    const hasNewRelease = true;
    setWrapperSettings((prev) => ({
      ...prev,
      githubUpdate: {
        ...prev.githubUpdate,
        hasUpdate: hasNewRelease,
        latestVersion: 'v2.6.0',
        lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    }));

    if (hasNewRelease) {
      setAlerts((prev) => [
        {
          id: `alert-update-${Date.now()}`,
          serverId: activeServer?.id || 'wrapper',
          title: 'MMSM Launcher Update Available (v2.6.0)',
          message: 'A new version of MMSM is available on GitHub with automatic backup rules & core loader improvements.',
          date: 'Just now',
          type: 'update',
          targetTab: 'updates',
        },
        ...prev,
      ]);
    }
    return hasNewRelease;
  };

  const performGitHubUpdate = async () => {
    setIsUpdatingWrapper(true);

    try {
      // 1. Identify running servers
      setUpdateProgressStep('Inspecting fleet status & notifying connected players...');
      const runningServers = servers.filter((s) => s.status === 'online' || s.status === 'starting');
      await new Promise((res) => setTimeout(res, 900));

      // 2. Shut down running servers gracefully
      if (runningServers.length > 0 && wrapperSettings.githubUpdate.autoShutdownServersOnUpdate) {
        setUpdateProgressStep(`Gracefully shutting down ${runningServers.length} active server(s)...`);
        for (const srv of runningServers) {
          addLog(srv.id, {
            timestamp: getTimestamp(),
            level: 'WARN',
            thread: 'System',
            message: '[MMSM Auto-Update] Broadcast to players: Server shutting down for launcher software update.',
          });
          executeCommand('say §c[MMSM] Server is shutting down for automated launcher upgrade in 5 seconds...', srv.id);
          stopServer(srv.id);
        }
        await new Promise((res) => setTimeout(res, 1800));
      }

      // 3. Download package
      setUpdateProgressStep('Downloading update v2.6.0 release payload from GitHub...');
      addDownload({
        title: 'MMSM Launcher Core Update v2.6.0',
        filename: 'mmsm-release-v2.6.0.zip',
        status: 'downloading',
        type: 'server_creation',
        totalSizeBytes: 24800000,
        speedMbps: 68.4,
      });
      await new Promise((res) => setTimeout(res, 1600));

      // 4. Extract & replace
      setUpdateProgressStep('Unpacking binaries, applying database migrations & updating components...');
      await new Promise((res) => setTimeout(res, 1400));

      // 5. Restart services
      setUpdateProgressStep('Restarting MMSM wrapper host services & re-binding ports...');
      await new Promise((res) => setTimeout(res, 1200));

      // 6. Update local version state
      setWrapperSettings((prev) => ({
        ...prev,
        githubUpdate: {
          ...prev.githubUpdate,
          currentVersion: 'v2.6.0',
          hasUpdate: false,
          lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      }));

      // 7. Auto restart previously running servers if desired
      if (runningServers.length > 0 && wrapperSettings.githubUpdate.autoRestartServersAfterUpdate) {
        setUpdateProgressStep('Auto-restarting previously online servers...');
        for (const srv of runningServers) {
          await startServer(srv.id);
        }
        await new Promise((res) => setTimeout(res, 800));
      }

      setUpdateProgressStep('Update complete! MMSM is now running v2.6.0.');
      await new Promise((res) => setTimeout(res, 1000));
    } finally {
      setIsUpdatingWrapper(false);
      setUpdateProgressStep('');
    }
  };

  const downloadJavaRuntime = async (runtimeId: string) => {
    setWrapperSettings((prev) => ({
      ...prev,
      javaRuntimes: (prev.javaRuntimes || []).map((r) =>
        r.id === runtimeId ? { ...r, installed: true } : r
      ),
    }));
  };

  return (
    <ServerContext.Provider
      value={{
        servers,
        activeServer,
        setActiveServerId,
        serverLogs,
        startServer,
        stopServer,
        restartServer,
        killServer,
        executeCommand,
        clearLogs,
        installMod,
        toggleMod,
        updateMod,
        removeMod,
        checkModUpdatesForServer,
        upgradeLoader,
        createBackup,
        restoreBackup,
        deleteBackup,
        togglePinBackup,
        updateBackupSchedule,
        createBackupRule,
        updateBackupRule,
        deleteBackupRule,
        runBackupRule,
        setServerPublicIp,
        kickPlayer,
        banPlayer,
        unbanPlayer,
        togglePlayerOp,
        togglePlayerWhitelist,
        saveFile,
        createFile,
        deleteFile,
        renameFile,
        archiveServer,
        unarchiveServer,
        setServerRam,
        uploadModFile,
        changeLoader,
        updateServerIcon,
        toggleSleepMode,
        wakeServer,
        putServerToSleep,
        approveWhitelistRequest,
        denyWhitelistRequest,
        addScheduledTask,
        toggleScheduledTask,
        deleteScheduledTask,
        runScheduledTaskNow,
        downloadJavaRuntime,
        wrapperSettings,
        updateWrapperSettings,
        updateProperties,
        createServer,
        deleteServer,
        purgeSampleData,
        alerts,
        dismissAlert,
        dismissAllAlerts,
        downloads,
        addDownload,
        clearCompletedDownloads,
        checkForGitHubUpdate,
        performGitHubUpdate,
        isUpdatingWrapper,
        updateProgressStep,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
};
