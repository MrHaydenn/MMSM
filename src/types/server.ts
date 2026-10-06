export type ServerStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'backing_up' | 'crashed' | 'sleeping';

export type ServerLoader = 'fabric' | 'neoforge' | 'forge' | 'paper' | 'purpur' | 'quilt' | 'vanilla';

export interface InstalledMod {
  id: string; // modrinth project_id or local filename slug
  name: string;
  slug: string;
  filename: string;
  installedVersionId: string;
  installedVersionNumber: string;
  latestVersionId?: string;
  latestVersionNumber?: string;
  hasUpdate?: boolean;
  enabled: boolean;
  fileSizeBytes: number;
  iconUrl?: string;
  summary: string;
  author: string;
  loaders: string[];
  gameVersions: string[];
  installedAt: string;
}

export interface Player {
  uuid: string;
  username: string;
  isOp: boolean;
  isWhitelisted: boolean;
  isBanned?: boolean;
  online: boolean;
  pingMs: number;
  playtimeMinutes: number;
  lastSeen: string;
  ipAddress: string;
  coords: { x: number; y: number; z: number; dimension: 'overworld' | 'nether' | 'the_end' };
  health: number; // 0-20
  food: number;   // 0-20
  gameMode: 'survival' | 'creative' | 'adventure' | 'spectator';
}

export interface WhitelistRequest {
  id: string;
  username: string;
  timestamp: string;
  ip: string;
  avatarUrl?: string;
  reason?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  type: 'backup' | 'restart' | 'command' | 'broadcast' | 'sleep';
  cronOrInterval: string; // e.g. "Every 6 Hours", "Daily at 04:00 AM", "Every 30 Minutes"
  command?: string;
  backupRuleId?: string;
  backupRuleName?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface PlayerSessionRecord {
  id: string;
  username: string;
  joinedAt: string;
  leftAt: string;
  durationMinutes: number;
  dimension: string;
  peakPing: number;
}

export interface AnalyticsDataPoint {
  timestamp: string;
  tps: number;
  cpuPercent: number;
  ramMb: number;
  onlinePlayers: number;
  networkMbps: number;
}

export interface JavaRuntime {
  id: string;
  name: string;
  version: number;
  vendor: string;
  path: string;
  installed: boolean;
  sizeMb: number;
  isDefault?: boolean;
}

export interface BackupRule {
  id: string;
  name: string;
  destinationPath: string; // e.g. "D:/MinecraftBackups/Survival" or "/Backups/Survival"
  retentionCount: number;  // e.g. 8 (oldest pruned when exceeded)
  includedPaths: string[]; // e.g. ['world', 'world_nether', 'world_the_end', 'mods', 'plugins', 'config', 'server.properties', 'whitelist.json']
  compressionLevel: 'fast' | 'normal' | 'maximum';
  notes?: string;
  createdAt: string;
  lastRunAt?: string;
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  isPinned: boolean;
  type: 'manual' | 'scheduled';
  minecraftVersion: string;
  loader: ServerLoader;
  ruleId?: string;
  ruleName?: string;
  destinationPath?: string;
  includedItems?: string[];
  notes?: string;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: '1h' | '6h' | '12h' | '24h' | 'weekly';
  maxKeepBackups: number;
  includeMods: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface ServerProperties {
  serverName: string;
  motd: string;
  serverPort: number;
  maxPlayers: number;
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  pvp: boolean;
  allowFlight: boolean;
  viewDistance: number;
  simulationDistance: number;
  onlineMode: boolean;
  spawnProtection: number;
  hardcore: boolean;
  whiteList: boolean;
  enableRcon: boolean;
  rconPort: number;
  rconPassword?: string;
  levelName?: string;
  levelSeed?: string;
  generatorSettings?: string;
  enableCommandBlock?: boolean;
  spawnAnimals?: boolean;
  spawnMonsters?: boolean;
  spawnNpcs?: boolean;
  generateStructures?: boolean;
  playerIdleTimeout?: number;
  networkCompressionThreshold?: number;
  maxWorldSize?: number;
  syncChunkWrites?: boolean;
  opPermissionLevel?: number;
  functionPermissionLevel?: number;
  resourcePackUrl?: string;
  resourcePackSha1?: string;
}

export interface ServerTelemetry {
  cpuPercent: number;
  ramUsedMb: number;
  ramMaxMb: number;
  tps: number;
  tickTimeMs: number;
  diskUsedMb: number;
  diskTotalMb: number;
  networkInKb: number;
  networkOutKb: number;
  uptimeSeconds: number;
}

export interface ServerLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CHAT' | 'CMD';
  thread: string;
  message: string;
}

export interface ServerFile {
  id: string;
  name: string;
  path: string; // e.g. "/server.properties", "/config/lithium.properties"
  isDirectory: boolean;
  sizeBytes: number;
  lastModified: string;
  content?: string;
  extension?: string;
}

export interface MinecraftServer {
  id: string;
  name: string;
  description: string;
  status: ServerStatus;
  loader: ServerLoader;
  loaderVersion: string;
  latestAvailableLoaderVersion?: string;
  minecraftVersion: string;
  latestAvailableMcVersion?: string;
  hasLoaderUpdate?: boolean;
  allocatedRamMb: number; // Max RAM (e.g. 4096)
  minRamMb: number;       // Min RAM (e.g. 2048)
  javaVersion: string;    // 'Java 21', 'Java 17', 'Java 8'
  port: number;
  publicServerIp?: string; // Optional custom public connect IP/domain override for this server
  serverIconUrl?: string; // Custom 64x64 server-icon.png
  properties: ServerProperties;
  mods: InstalledMod[];
  players: Player[];
  backups: BackupRecord[];
  backupRules?: BackupRule[];
  backupSchedule: BackupSchedule;
  telemetry: ServerTelemetry;
  files: ServerFile[];
  isArchived?: boolean;
  // Sleep Mode (AMP-style auto sleep on inactivity & auto wake on ping)
  sleepModeEnabled?: boolean;
  sleepInactivityMinutes?: number;
  isSleeping?: boolean;
  // Whitelist Join Requests
  whitelistRequests?: WhitelistRequest[];
  // Scheduling tasks
  scheduledTasks?: ScheduledTask[];
  // Analytics
  analyticsHistory?: AnalyticsDataPoint[];
  playerSessions?: PlayerSessionRecord[];
  uptimeStartedAt?: string;
  createdAt: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  avatarSeed: string;
  customAvatarUrl?: string;
  password?: string;
  createdAt: string;
  lastLogin: string;
  allowedServerIds?: string[]; // empty means all servers
}

export interface DownloadItem {
  id: string;
  serverId?: string;
  serverName?: string;
  title: string;
  filename: string;
  progressPercent: number;
  status: 'downloading' | 'installing' | 'completed' | 'failed';
  totalSizeBytes?: number;
  speedMbps?: number;
  type: 'mod' | 'plugin' | 'modpack' | 'server_creation' | 'backup';
  startedAt: string;
  completedAt?: string;
}

export interface WrapperSettings {
  autoAcceptEula: boolean;
  publicIp?: string;
  customWrapperLogoUrl?: string;
  serversDirectory?: string;
  backupsDirectory?: string;
  defaultMinRamGb: number;
  defaultMaxRamGb: number;
  defaultJavaPath: string;
  portRangeStart: number;
  portRangeEnd: number;
  telemetryIntervalMs: number;
  enableAnonymousTelemetry: boolean;
  javaRuntimes?: JavaRuntime[];
}

export interface ModrinthSearchResult {
  project_id: string;
  project_type: 'mod' | 'modpack' | 'resourcepack' | 'shader';
  slug: string;
  author: string;
  title: string;
  description: string;
  categories: string[];
  display_categories: string[];
  versions: string[];
  downloads: number;
  follows: number;
  icon_url: string;
  date_created: string;
  date_modified: string;
  latest_version: string;
  license: string;
  client_side: string;
  server_side: string;
  gallery: string[];
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  author_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  version_type: 'release' | 'beta' | 'alpha';
  date_published: string;
  downloads: number;
  files: {
    hashes: { sha1: string; sha512: string };
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
  changelog?: string;
}
