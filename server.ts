import express from 'express';
import { createServer as createViteServer } from 'vite';
import { spawn, ChildProcess, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';

const app = express();
app.use(express.json({ limit: '100mb' }));

const PORT = Number(process.env.PORT) || 3000;
const SERVERS_DIR = path.resolve(process.cwd(), 'servers');
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const RUNTIMES_DIR = path.resolve(process.cwd(), 'runtimes');

if (!fs.existsSync(SERVERS_DIR)) fs.mkdirSync(SERVERS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RUNTIMES_DIR)) fs.mkdirSync(RUNTIMES_DIR, { recursive: true });

// Disk Files for Persistence
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WRAPPER_FILE = path.join(DATA_DIR, 'wrapper_settings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

// Helper for JSON storage
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(text) as T;
    }
  } catch {}
  return defaultValue;
}

function writeJsonFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e: any) {
    console.error(`Error writing ${filePath}:`, e.message);
  }
}

// Process & Status registry
interface ServerProcess {
  process: ChildProcess;
  serverId: string;
  serverName: string;
  port: number;
  pid: number;
  startedAt: string;
}

const activeProcesses: Record<string, ServerProcess> = {};
const serverStatusMap: Record<string, 'online' | 'offline' | 'starting' | 'stopping' | 'crashed' | 'sleeping'> = {};
const logsBuffer: Record<string, { id: string; timestamp: string; level: string; thread: string; message: string }[]> = {};

function addServerLog(serverId: string, level: string, thread: string, message: string) {
  if (!logsBuffer[serverId]) logsBuffer[serverId] = [];
  const item = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    level,
    thread,
    message,
  };
  logsBuffer[serverId].push(item);
  if (logsBuffer[serverId].length > 1200) {
    logsBuffer[serverId] = logsBuffer[serverId].slice(-900);
  }
}

// Helper to download files with automatic redirect handling & streaming
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download from ${url}: Status ${res.status} ${res.statusText}`);
  }
  const fileStream = fs.createWriteStream(destPath);
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
  }
  await new Promise((resolve) => fileStream.end(resolve));
}

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Search for Java executables on system
function findBestJavaExecutable(preferredPath?: string, requestedVersion?: string): { cmd: string; name: string } {
  // If preferredPath is a direct valid path to java executable
  if (preferredPath && preferredPath !== 'java' && preferredPath !== 'auto' && preferredPath !== 'system-default' && fs.existsSync(preferredPath)) {
    return { cmd: preferredPath, name: `Custom Java (${preferredPath})` };
  }

  const internalJava21 = path.join(RUNTIMES_DIR, 'java-21', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  const internalJava17 = path.join(RUNTIMES_DIR, 'java-17', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  const internalJava8  = path.join(RUNTIMES_DIR, 'java-8',  'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  const internalJava25 = path.join(RUNTIMES_DIR, 'java-25', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');

  const reqStr = `${preferredPath || ''} ${requestedVersion || ''}`.toLowerCase();

  // If explicit version requested
  if (reqStr.includes('21') && !reqStr.includes('25')) {
    if (fs.existsSync(internalJava21)) return { cmd: internalJava21, name: 'Managed Eclipse Temurin Java 21 LTS (MMSM)' };
  } else if (reqStr.includes('17')) {
    if (fs.existsSync(internalJava17)) return { cmd: internalJava17, name: 'Managed Eclipse Temurin Java 17 LTS (MMSM)' };
  } else if (reqStr.includes('8')) {
    if (fs.existsSync(internalJava8)) return { cmd: internalJava8, name: 'Managed Eclipse Temurin Java 8 (MMSM)' };
  } else if (reqStr.includes('25')) {
    if (fs.existsSync(internalJava25)) return { cmd: internalJava25, name: 'Managed Eclipse Temurin Java 25 (MMSM)' };
  }

  // Fallback preference: Java 21 LTS (Standard for MC 1.20.5+ / 1.21.x) -> Java 17 -> Java 8 -> Java 25
  if (fs.existsSync(internalJava21)) return { cmd: internalJava21, name: 'Managed Eclipse Temurin Java 21 LTS (MMSM)' };
  if (fs.existsSync(internalJava17)) return { cmd: internalJava17, name: 'Managed Eclipse Temurin Java 17 LTS (MMSM)' };
  if (fs.existsSync(internalJava8))  return { cmd: internalJava8,  name: 'Managed Eclipse Temurin Java 8 (MMSM)' };
  if (fs.existsSync(internalJava25)) return { cmd: internalJava25, name: 'Managed Eclipse Temurin Java 25 (MMSM)' };

  // Check Linux system paths
  if (os.platform() === 'linux') {
    const linuxJvmDirs = ['/usr/lib/jvm', '/usr/java', '/opt/java'];
    for (const base of linuxJvmDirs) {
      if (fs.existsSync(base)) {
        try {
          const subdirs = fs.readdirSync(base);
          for (const dir of subdirs) {
            const exePath = path.join(base, dir, 'bin', 'java');
            if (fs.existsSync(exePath)) {
              return { cmd: exePath, name: `System Java (${dir})` };
            }
          }
        } catch {}
      }
    }
  }

  if (os.platform() === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const username = os.userInfo() ? os.userInfo().username : '';
    const localAppData = process.env['LOCALAPPDATA'] || `C:\\Users\\${username}\\AppData\\Local`;

    const searchBases = [
      path.join(pf, 'Eclipse Adoptium'),
      path.join(pf, 'Java'),
      path.join(pf, 'Microsoft'),
      path.join(pf, 'Amazon Corretto'),
      path.join(pf, 'Zulu'),
      path.join(pf, 'BellSoft'),
      path.join(pf86, 'Java'),
      path.join(localAppData, 'Programs', 'Eclipse Adoptium'),
    ];

    const targetVer = reqStr.includes('21') ? '21' : reqStr.includes('17') ? '17' : reqStr.includes('8') ? '8' : reqStr.includes('25') ? '25' : '21';
    for (const base of searchBases) {
      if (fs.existsSync(base)) {
        try {
          const subdirs = fs.readdirSync(base);
          for (const dir of subdirs) {
            if (dir.toLowerCase().includes(targetVer)) {
              const exePath = path.join(base, dir, 'bin', 'java.exe');
              if (fs.existsSync(exePath)) {
                return { cmd: exePath, name: `Java ${targetVer} (${dir})` };
              }
            }
          }
        } catch {}
      }
    }
  }

  if (process.env.JAVA_HOME) {
    const jhExe = path.join(process.env.JAVA_HOME, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(jhExe)) {
      return { cmd: jhExe, name: `JAVA_HOME (${process.env.JAVA_HOME})` };
    }
  }

  return { cmd: 'java', name: 'System Default Java (PATH)' };
}

// Scan installed Java Runtimes
function scanInstalledJavaRuntimes() {
  const list: { id: string; name: string; path: string; isDefault?: boolean }[] = [];
  
  const internalJava21 = path.join(RUNTIMES_DIR, 'java-21', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  if (fs.existsSync(internalJava21)) {
    list.push({ id: 'mmsm-java21', name: 'Managed Eclipse Temurin Java 21 LTS (MMSM)', path: internalJava21, isDefault: true });
  }

  const internalJava17 = path.join(RUNTIMES_DIR, 'java-17', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  if (fs.existsSync(internalJava17)) {
    list.push({ id: 'mmsm-java17', name: 'Managed Eclipse Temurin Java 17 LTS (MMSM)', path: internalJava17, isDefault: !fs.existsSync(internalJava21) });
  }

  const internalJava8 = path.join(RUNTIMES_DIR, 'java-8', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  if (fs.existsSync(internalJava8)) {
    list.push({ id: 'mmsm-java8', name: 'Managed Eclipse Temurin Java 8 (MMSM)', path: internalJava8 });
  }

  const internalJava25 = path.join(RUNTIMES_DIR, 'java-25', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  if (fs.existsSync(internalJava25)) {
    list.push({ id: 'mmsm-java25', name: 'Managed Eclipse Temurin Java 25 Experimental (MMSM)', path: internalJava25 });
  }

  list.push({ id: 'system-default', name: 'System Default Java (PATH)', path: 'java', isDefault: list.length === 0 });

  if (os.platform() === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const username = os.userInfo() ? os.userInfo().username : '';
    const localAppData = process.env['LOCALAPPDATA'] || `C:\\Users\\${username}\\AppData\\Local`;

    const searchBases = [
      path.join(pf, 'Eclipse Adoptium'),
      path.join(pf, 'Java'),
      path.join(pf, 'Microsoft'),
      path.join(pf, 'Amazon Corretto'),
      path.join(pf, 'Zulu'),
      path.join(pf, 'BellSoft'),
      path.join(pf86, 'Java'),
      path.join(localAppData, 'Programs', 'Eclipse Adoptium'),
    ];

    for (const base of searchBases) {
      if (fs.existsSync(base)) {
        try {
          const subdirs = fs.readdirSync(base);
          for (const dir of subdirs) {
            const exePath = path.join(base, dir, 'bin', 'java.exe');
            if (fs.existsSync(exePath)) {
              list.push({
                id: `java-${dir.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                name: `${dir}`,
                path: exePath,
              });
            }
          }
        } catch {}
      }
    }
  }
  return list;
}

// ----------------------------------------------------
// SYSTEM INFO & RUNTIMES
// ----------------------------------------------------
app.get('/api/system/info', (req, res) => {
  const totalMemGb = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeMemGb = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const cpuCores = os.cpus().length;
  const runtimes = scanInstalledJavaRuntimes();
  const internalJava21 = path.join(RUNTIMES_DIR, 'java-21', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  const hasJava21 = fs.existsSync(internalJava21) || runtimes.some((r) => r.name.toLowerCase().includes('21'));

  res.json({
    totalMemGb,
    freeMemGb,
    cpuCores,
    platform: os.platform(),
    serversDirectory: SERVERS_DIR,
    backupsDirectory: BACKUPS_DIR,
    detectedJavaRuntimes: runtimes,
    hasJava21Installed: hasJava21,
  });
});

app.get('/api/system/java-runtimes', (req, res) => {
  const runtimes = scanInstalledJavaRuntimes();
  const internalJava21 = path.join(RUNTIMES_DIR, 'java-21', 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  const hasJava21 = fs.existsSync(internalJava21) || runtimes.some((r) => r.name.toLowerCase().includes('21'));
  res.json({ runtimes, hasJava21Installed: hasJava21, internalJava21Path: internalJava21 });
});

// ----------------------------------------------------
// AUTH & USERS API (Backend Disk Persistence)
// ----------------------------------------------------
app.get('/api/auth/state', (req, res) => {
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const settings = readJsonFile<any>(WRAPPER_FILE, {});
  res.json({
    hasAccounts: users.length > 0,
    allowPublicSignups: settings.allowPublicSignups ?? false,
    users,
  });
});

app.post('/api/auth/register-owner', (req, res) => {
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const settings = readJsonFile<any>(WRAPPER_FILE, {});

  if (users.length > 0 && !(settings.allowPublicSignups ?? false)) {
    return res.status(403).json({ success: false, error: 'Registration is locked. An owner account already exists.' });
  }

  const { username, displayName, password } = req.body;
  const cleanUsername = (username || '').trim().toLowerCase();
  if (!cleanUsername) return res.status(400).json({ success: false, error: 'Username is required' });

  const newUser = {
    id: `user-${Date.now()}`,
    username: cleanUsername,
    displayName: (displayName || cleanUsername).trim(),
    role: users.length === 0 ? 'admin' : 'operator',
    password: password || '',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  const updatedUsers = [newUser, ...users];
  writeJsonFile(USERS_FILE, updatedUsers);
  res.json({ success: true, user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim().toLowerCase();

  const found = users.find((u) => u.username.toLowerCase() === cleanUsername);
  if (!found) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }

  if (found.password && password && found.password !== password) {
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }

  const updatedUser = { ...found, lastLogin: new Date().toISOString() };
  const updatedList = users.map((u) => (u.id === found.id ? updatedUser : u));
  writeJsonFile(USERS_FILE, updatedList);

  res.json({ success: true, user: updatedUser });
});

app.post('/api/auth/users/save-all', (req, res) => {
  const { users } = req.body;
  if (Array.isArray(users)) {
    writeJsonFile(USERS_FILE, users);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid users array' });
  }
});

// ----------------------------------------------------
// WRAPPER SETTINGS & SERVERS DATA API
// ----------------------------------------------------
app.get('/api/wrapper-settings', (req, res) => {
  const settings = readJsonFile<any>(WRAPPER_FILE, {});
  res.json({ settings });
});

app.post('/api/wrapper-settings', (req, res) => {
  const { settings } = req.body;
  if (settings) {
    const existing = readJsonFile<any>(WRAPPER_FILE, {});
    const updated = { ...existing, ...settings };
    writeJsonFile(WRAPPER_FILE, updated);
    res.json({ success: true, settings: updated });
  } else {
    res.status(400).json({ error: 'Settings object required' });
  }
});

app.get('/api/servers-data', (req, res) => {
  const servers = readJsonFile<any[]>(SERVERS_FILE, []);
  // Sync status and server-port from server.properties on disk
  const updated = servers.map((s) => {
    let port = s.port;
    let properties = { ...s.properties };
    const propsPath = path.join(SERVERS_DIR, s.name, 'server.properties');
    if (fs.existsSync(propsPath)) {
      try {
        const text = fs.readFileSync(propsPath, 'utf-8');
        const match = text.match(/^server-port\s*=\s*(\d+)/m);
        if (match && match[1]) {
          const parsedPort = Number(match[1]);
          if (parsedPort > 0) {
            port = parsedPort;
            properties.serverPort = parsedPort;
          }
        }
      } catch {}
    }

    return {
      ...s,
      port,
      properties,
      status: serverStatusMap[s.id] || (activeProcesses[s.id] ? 'online' : (s.status === 'crashed' ? 'crashed' : 'offline')),
    };
  });
  res.json({ servers: updated });
});

app.post('/api/servers-data', (req, res) => {
  const { servers } = req.body;
  if (Array.isArray(servers)) {
    writeJsonFile(SERVERS_FILE, servers);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Servers array required' });
  }
});

// ----------------------------------------------------
// GEMINI AI CRASH ANALYZER
// ----------------------------------------------------
app.post('/api/gemini/analyze-crash', async (req, res) => {
  const { serverName, loader, minecraftVersion, logs, crashSnippet } = req.body;

  const logsText = crashSnippet || (Array.isArray(logs) ? logs.slice(-30).map((l: any) => l.message).join('\n') : '');

  const prompt = `You are a Minecraft server sysadmin and Java engineer.
Analyze the following crash log and stack trace to diagnose the exact root cause and give clear, step-by-step fix instructions.

Server Name: ${serverName || 'Minecraft Server'}
Server Core/Loader: ${loader || 'fabric'}
Minecraft Version: ${minecraftVersion || '1.21.4'}

Crash Output:
${logsText || 'No logs provided'}

Provide a structured answer in Markdown:
1. **Root Cause Analysis** (Identify why the server crashed: e.g. Java Class File Version mismatch like class 69.0 requiring Java 25, class 65.0 requiring Java 21, or missing mod, OOM, corrupted world).
2. **Required Java Version** (If class file version error: 69.0 = Java 25, 65.0 = Java 21, 61.0 = Java 17, 52.0 = Java 8).
3. **Step-by-Step Fix Steps** for the user.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    res.json({ success: true, analysis: response.text });
  } catch (err: any) {
    res.json({
      success: false,
      error: err.message || 'Gemini API call failed',
      fallbackPrompt: prompt,
    });
  }
});

// ----------------------------------------------------
// AUTO-INSTALL JAVA RUNTIMES (25, 21 LTS, 17 LTS & 8)
// ----------------------------------------------------
const javaInstallJobs: Record<string, { status: 'idle' | 'downloading' | 'completed' | 'failed'; path?: string; message?: string; error?: string }> = {};

async function handleInstallJava(version: string) {
  const targetVer = version === '8' ? '8' : version === '17' ? '17' : version === '25' ? '25' : '21';
  const targetDir = path.join(RUNTIMES_DIR, `java-${targetVer}`);
  const javaExe = path.join(targetDir, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');

  if (fs.existsSync(javaExe)) {
    const info = { success: true, installed: true, path: javaExe, version: targetVer, message: `Eclipse Temurin Java ${targetVer} is already installed.` };
    javaInstallJobs[targetVer] = { status: 'completed', path: javaExe, message: info.message };
    return info;
  }

  javaInstallJobs[targetVer] = { status: 'downloading', message: `Downloading OpenJDK / Eclipse Temurin Java ${targetVer}...` };

  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const isWin = os.platform() === 'win32';
    const plat = isWin ? 'windows' : 'linux';
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
    const ext = isWin ? 'zip' : 'tar.gz';
    const zipPath = path.join(RUNTIMES_DIR, `java${targetVer}-download.${ext}`);

    // Adoptium v3 API URLs with robust fallback options
    let urls: string[] = [];
    if (targetVer === '25') {
      urls = [
        `https://api.adoptium.net/v3/binary/latest/25/ea/${plat}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`,
        `https://api.adoptium.net/v3/binary/latest/24/ea/${plat}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`,
        isWin ? 'https://download.oracle.com/java/25/archive/jdk-25-ea+1_windows-x64_bin.zip' : 'https://download.oracle.com/java/25/archive/jdk-25-ea+1_linux-x64_bin.tar.gz',
      ];
    } else if (targetVer === '21') {
      urls = [
        `https://api.adoptium.net/v3/binary/latest/21/ga/${plat}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`,
        isWin ? 'https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.zip' : 'https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz',
      ];
    } else if (targetVer === '17') {
      urls = [
        `https://api.adoptium.net/v3/binary/latest/17/ga/${plat}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`,
        isWin ? 'https://download.oracle.com/java/17/latest/jdk-17_windows-x64_bin.zip' : 'https://download.oracle.com/java/17/latest/jdk-17_linux-x64_bin.tar.gz',
      ];
    } else {
      urls = [
        `https://api.adoptium.net/v3/binary/latest/8/ga/${plat}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`,
      ];
    }

    let downloadSuccess = false;
    let lastError = '';
    for (const url of urls) {
      try {
        console.log(`[MMSM] Attempting download for Java ${targetVer} from ${url}...`);
        await downloadFile(url, zipPath);
        if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1000000) {
          downloadSuccess = true;
          break;
        }
      } catch (err: any) {
        lastError = err.message || String(err);
      }
    }

    if (!downloadSuccess) {
      throw new Error(`Failed to download Java ${targetVer} archive. ${lastError}`);
    }

    console.log(`[MMSM] Extracting Java ${targetVer} JDK into ${targetDir}...`);
    javaInstallJobs[targetVer] = { status: 'downloading', message: `Extracting Java ${targetVer} JDK binaries into ./runtimes/java-${targetVer}...` };

    if (isWin) {
      const tempExtract = path.join(RUNTIMES_DIR, `temp-j${targetVer}`);
      if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
      fs.mkdirSync(tempExtract, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtract}' -Force"`;
        exec(cmd, (err) => {
          if (err) return reject(err);
          try {
            const subdirs = fs.readdirSync(tempExtract);
            const innerFolder = subdirs.find((d) => fs.statSync(path.join(tempExtract, d)).isDirectory());
            if (innerFolder) {
              const innerPath = path.join(tempExtract, innerFolder);
              fs.cpSync(innerPath, targetDir, { recursive: true });
            } else {
              fs.cpSync(tempExtract, targetDir, { recursive: true });
            }
            fs.rmSync(tempExtract, { recursive: true, force: true });
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            resolve();
          } catch (mErr) {
            reject(mErr);
          }
        });
      });
    } else {
      await new Promise<void>((resolve) => {
        exec(`tar -xzf "${zipPath}" -C "${targetDir}" --strip-components=1 || unzip -o "${zipPath}" -d "${targetDir}"`, () => {
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
          try {
            const subdirs = fs.readdirSync(targetDir);
            if (subdirs.length === 1 && fs.statSync(path.join(targetDir, subdirs[0])).isDirectory()) {
              const inner = path.join(targetDir, subdirs[0]);
              fs.cpSync(inner, targetDir, { recursive: true });
              fs.rmSync(inner, { recursive: true, force: true });
            }
          } catch {}
          resolve();
        });
      });
    }

    // Ensure javaExe exists inside targetDir/bin/
    if (!fs.existsSync(javaExe)) {
      const findJava = (dir: string): string | null => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const found = findJava(full);
              if (found) return found;
            } else if (entry.name === (isWin ? 'java.exe' : 'java')) {
              return full;
            }
          }
        } catch {}
        return null;
      };
      const foundExe = findJava(targetDir);
      if (foundExe) {
        const binDir = path.dirname(foundExe);
        const jdkRoot = path.dirname(binDir);
        if (jdkRoot !== targetDir) {
          fs.cpSync(jdkRoot, targetDir, { recursive: true });
        }
      }
    }

    if (!fs.existsSync(javaExe)) {
      throw new Error(`Extraction finished but binary was not found at ${javaExe}`);
    }

    const result = { success: true, installed: true, path: javaExe, version: targetVer, message: `Eclipse Temurin Java ${targetVer} installed successfully in MMSM runtimes!` };
    javaInstallJobs[targetVer] = { status: 'completed', path: javaExe, message: result.message };
    return result;
  } catch (err: any) {
    const failInfo = { success: false, error: err.message || `Failed to install Java ${targetVer}` };
    javaInstallJobs[targetVer] = { status: 'failed', error: failInfo.error };
    return failInfo;
  }
}

app.post('/api/system/install-java', (req, res) => {
  const version = (req.body?.version || '21').toString();
  const targetVer = version === '8' ? '8' : version === '17' ? '17' : version === '25' ? '25' : '21';

  // Trigger background execution if not already running
  if (!javaInstallJobs[targetVer] || javaInstallJobs[targetVer].status !== 'downloading') {
    handleInstallJava(targetVer);
  }

  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, status: 'started', version: targetVer });
});

app.get('/api/system/install-java/status', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({ jobs: javaInstallJobs, runtimes: scanInstalledJavaRuntimes() });
});

app.post('/api/system/install-java21', (req, res) => {
  if (!javaInstallJobs['21'] || javaInstallJobs['21'].status !== 'downloading') {
    handleInstallJava('21');
  }
  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, status: 'started', version: '21' });
});

app.post('/api/system/install-java25', (req, res) => {
  if (!javaInstallJobs['25'] || javaInstallJobs['25'].status !== 'downloading') {
    handleInstallJava('25');
  }
  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, status: 'started', version: '25' });
});

// ----------------------------------------------------
// SERVER PROCESS START / STOP / KILL / COMMAND
// ----------------------------------------------------
app.get('/api/servers/running', (req, res) => {
  const running = Object.keys(activeProcesses).map((id) => ({
    serverId: id,
    serverName: activeProcesses[id].serverName,
    port: activeProcesses[id].port,
    pid: activeProcesses[id].pid,
    startedAt: activeProcesses[id].startedAt,
    status: serverStatusMap[id] || 'online',
  }));
  res.json({ running, statusMap: serverStatusMap });
});

app.post('/api/servers/:id/start', async (req, res) => {
  const { id } = req.params;
  const {
    name = 'Minecraft Server',
    port: bodyPort = 25565,
    minRamMb = 1024,
    ramMb = 2048,
    loader = 'fabric',
    minecraftVersion = '1.21.4',
    javaPath,
  } = req.body;

  const serverFolder = path.join(SERVERS_DIR, name);
  if (!fs.existsSync(serverFolder)) fs.mkdirSync(serverFolder, { recursive: true });

  const eulaPath = path.join(serverFolder, 'eula.txt');
  if (!fs.existsSync(eulaPath)) {
    fs.writeFileSync(eulaPath, '#Accepted via MMSM\neula=true\n');
  }

  let bindPort = Number(bodyPort) || 25565;
  const propsPath = path.join(serverFolder, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    const propsContent = `#Minecraft server properties\nserver-port=${bindPort}\nserver-ip=\nmax-players=20\nonline-mode=true\nlevel-name=world\nmotd=${name}\nenable-rcon=false\n`;
    fs.writeFileSync(propsPath, propsContent);
  } else {
    const content = fs.readFileSync(propsPath, 'utf-8');
    const match = content.match(/^server-port\s*=\s*(\d+)/m);
    if (match && match[1]) {
      bindPort = Number(match[1]);
    } else {
      fs.appendFileSync(propsPath, `\nserver-port=${bindPort}\n`);
    }
  }

  if (activeProcesses[id] && !activeProcesses[id].process.killed) {
    serverStatusMap[id] = 'online';
    return res.json({ success: true, message: 'Server is already running', pid: activeProcesses[id].pid, port: bindPort });
  }

  addServerLog(id, 'INFO', 'Launcher', `Directory: ${serverFolder}`);

  const jarPath = path.join(serverFolder, 'server.jar');

  if (!fs.existsSync(jarPath)) {
    addServerLog(id, 'INFO', 'Downloader', `Server JAR missing. Fetching ${loader.toUpperCase()} ${minecraftVersion} server binary...`);
    try {
      if (loader === 'paper') {
        const buildRes = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${minecraftVersion}`);
        const buildData = await buildRes.json();
        const latestBuild = buildData.builds[buildData.builds.length - 1];
        const jarUrl = `https://api.papermc.io/v2/projects/paper/versions/${minecraftVersion}/builds/${latestBuild}/downloads/paper-${minecraftVersion}-${latestBuild}.jar`;
        await downloadFile(jarUrl, jarPath);
      } else if (loader === 'purpur') {
        const jarUrl = `https://api.purpurmc.org/v2/purpur/${minecraftVersion}/latest/download`;
        await downloadFile(jarUrl, jarPath);
      } else if (loader === 'fabric') {
        const jarUrl = `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/0.16.10/1.0.1/server/jar`;
        await downloadFile(jarUrl, jarPath);
      } else {
        const manifestRes = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
        const manifest = await manifestRes.json();
        const target = manifest.versions.find((v: any) => v.id === minecraftVersion);
        if (target) {
          const verRes = await fetch(target.url);
          const verData = await verRes.json();
          const vanillaJarUrl = verData.downloads?.server?.url;
          if (vanillaJarUrl) {
            await downloadFile(vanillaJarUrl, jarPath);
          }
        }
      }
      addServerLog(id, 'INFO', 'Downloader', `Successfully downloaded server.jar into ${serverFolder}`);
    } catch (dlErr: any) {
      addServerLog(id, 'WARN', 'Downloader', `Could not download automatic server JAR: ${dlErr.message}`);
    }
  }

  // Determine Java executable selection
  let requestedJavaVer: string | undefined = undefined;
  if (javaPath && javaPath !== 'auto' && javaPath !== 'system-default') {
    addServerLog(id, 'INFO', 'Launcher', `User configured manual Java Selection: "${javaPath}"`);
    requestedJavaVer = javaPath;

    // Check if configured version is missing from ./runtimes/ and auto-install it
    const reqStr = javaPath.toLowerCase();
    const targetVer = reqStr.includes('25') ? '25' : reqStr.includes('21') ? '21' : reqStr.includes('17') ? '17' : reqStr.includes('8') ? '8' : '';
    if (targetVer) {
      const targetExe = path.join(RUNTIMES_DIR, `java-${targetVer}`, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
      if (!fs.existsSync(targetExe)) {
        addServerLog(id, 'INFO', 'Launcher', `Configured Java ${targetVer} missing from runtimes. Auto-downloading Eclipse Temurin JDK ${targetVer}...`);
        try {
          await handleInstallJava(targetVer);
        } catch (jErr: any) {
          addServerLog(id, 'WARN', 'Launcher', `Auto-install Java ${targetVer} notice: ${jErr.message}`);
        }
      }
    }
  } else {
    // Auto mode: Determine correct Java LTS version based on Minecraft core requirements
    // Minecraft 1.20.5+ & 1.21.x (Vanilla, Fabric 0.16.x, Paper, NeoForge) -> Java 21 LTS
    // Minecraft 1.17 to 1.20.4 -> Java 17 LTS
    // Minecraft 1.16.5 and below -> Java 8
    const mcSub = parseInt((minecraftVersion || '1.21').split('.')[2] || '0', 10);
    if (minecraftVersion.startsWith('1.21') || (minecraftVersion.startsWith('1.20') && mcSub >= 5) || minecraftVersion.startsWith('26.')) {
      requestedJavaVer = '21';
    } else if (minecraftVersion.startsWith('1.17') || minecraftVersion.startsWith('1.18') || minecraftVersion.startsWith('1.19') || minecraftVersion.startsWith('1.20')) {
      requestedJavaVer = '17';
    } else {
      requestedJavaVer = '8';
    }

    addServerLog(id, 'INFO', 'Launcher', `Auto-matched Java requirement for ${loader.toUpperCase()} ${minecraftVersion}: Java ${requestedJavaVer} LTS`);

    const internalAutoExe = path.join(RUNTIMES_DIR, `java-${requestedJavaVer}`, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
    if (!fs.existsSync(internalAutoExe)) {
      addServerLog(id, 'INFO', 'Launcher', `Auto-downloading Eclipse Temurin JDK ${requestedJavaVer} into ./runtimes/java-${requestedJavaVer}...`);
      try {
        await handleInstallJava(requestedJavaVer);
      } catch (jErr: any) {
        addServerLog(id, 'WARN', 'Launcher', `Auto-install Java ${requestedJavaVer} notice: ${jErr.message}`);
      }
    }
  }

  const bestJava = findBestJavaExecutable(javaPath, requestedJavaVer);
  let javaExecPath = bestJava.cmd.replace(/^"|"$/g, '');

  // Safety fallback: If bestJava resolved to system 'java' but system java does not exist in PATH,
  // use internal Java 21 or Java 17 runtime
  if (javaExecPath === 'java') {
    const isWin = os.platform() === 'win32';
    const j21 = path.join(RUNTIMES_DIR, 'java-21', 'bin', isWin ? 'java.exe' : 'java');
    const j17 = path.join(RUNTIMES_DIR, 'java-17', 'bin', isWin ? 'java.exe' : 'java');
    if (fs.existsSync(j21)) {
      javaExecPath = j21;
    } else if (fs.existsSync(j17)) {
      javaExecPath = j17;
    } else {
      addServerLog(id, 'INFO', 'Launcher', 'No Java executable found on system. Auto-downloading Java 21 LTS...');
      await handleInstallJava('21');
      if (fs.existsSync(j21)) {
        javaExecPath = j21;
      }
    }
  }

  if (os.platform() !== 'win32' && fs.existsSync(javaExecPath)) {
    try { fs.chmodSync(javaExecPath, 0o755); } catch {}
  }

  addServerLog(id, 'INFO', 'Launcher', `Resolved Java Executable: ${bestJava.name} -> "${javaExecPath}"`);

  if (!fs.existsSync(javaExecPath) && javaExecPath !== 'java') {
    addServerLog(id, 'ERROR', 'Launcher', `Java binary not found at "${javaExecPath}". Please install Java runtime from Wrapper Settings.`);
    serverStatusMap[id] = 'crashed';
    return res.status(400).json({ success: false, error: `Java binary not found at "${javaExecPath}". Install Java in Settings.` });
  }

  const xms = `${minRamMb || 1024}M`;
  const xmx = `${ramMb || 2048}M`;

  addServerLog(id, 'INFO', 'Launcher', `Spawning Java process: "${javaExecPath}" -Xms${xms} -Xmx${xmx} -jar server.jar nogui`);

  try {
    const child = spawn(javaExecPath, [`-Xms${xms}`, `-Xmx${xmx}`, '-jar', 'server.jar', 'nogui'], {
      cwd: serverFolder,
      shell: false,
      windowsHide: true,
    });

    if (!child.pid) {
      addServerLog(id, 'ERROR', 'Launcher', 'Failed to acquire process PID.');
      serverStatusMap[id] = 'crashed';
      return res.status(500).json({ success: false, error: 'Failed to spawn process' });
    }

    activeProcesses[id] = {
      process: child,
      serverId: id,
      serverName: name,
      port: bindPort,
      pid: child.pid,
      startedAt: new Date().toISOString(),
    };
    serverStatusMap[id] = 'online';

    addServerLog(id, 'INFO', 'Launcher', `Server process running (PID: ${child.pid}). Listening on port ${bindPort}.`);

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        text.split('\n').forEach((line: string) => {
          addServerLog(id, 'INFO', 'Server thread', line);
        });
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        text.split('\n').forEach((line: string) => {
          addServerLog(id, 'WARN', 'Server thread', line);
        });
      }
    });

    child.on('close', (code) => {
      delete activeProcesses[id];
      const isCrash = code !== 0 && code !== null;
      if (serverStatusMap[id] !== 'sleeping') {
        serverStatusMap[id] = isCrash ? 'crashed' : 'offline';
      }

      if (isCrash) {
        addServerLog(id, 'ERROR', 'System', `[CRASH DETECTED] Server process exited with crash code ${code}`);
      } else if (serverStatusMap[id] === 'sleeping') {
        addServerLog(id, 'INFO', 'HibernationProxy', '[Sleep Mode] Server process suspended into hibernation mode. Standby proxy active.');
      } else {
        addServerLog(id, 'INFO', 'System', `Server process stopped safely with exit code ${code}`);
      }

      // Persist status change to servers.json
      try {
        const currentServers = readJsonFile<any[]>(SERVERS_FILE, []);
        const updatedServers = currentServers.map((s) => (s.id === id ? { ...s, status: serverStatusMap[id] } : s));
        writeJsonFile(SERVERS_FILE, updatedServers);
      } catch {}
    });

    child.on('error', (procErr) => {
      delete activeProcesses[id];
      serverStatusMap[id] = 'crashed';
      addServerLog(id, 'ERROR', 'System', `Process error: ${procErr.message}`);

      try {
        const currentServers = readJsonFile<any[]>(SERVERS_FILE, []);
        const updatedServers = currentServers.map((s) => (s.id === id ? { ...s, status: 'crashed' } : s));
        writeJsonFile(SERVERS_FILE, updatedServers);
      } catch {}
    });

    res.json({ success: true, pid: child.pid, port: bindPort });
  } catch (spawnErr: any) {
    serverStatusMap[id] = 'crashed';
    addServerLog(id, 'ERROR', 'Launcher', `Spawn exception: ${spawnErr.message}`);
    res.status(500).json({ success: false, error: spawnErr.message });
  }
});

app.post('/api/servers/:id/stop', (req, res) => {
  const { id } = req.params;
  const proc = activeProcesses[id];
  if (!proc) {
    serverStatusMap[id] = 'offline';
    return res.json({ success: true, message: 'Server is not running' });
  }

  serverStatusMap[id] = 'stopping';
  addServerLog(id, 'INFO', 'Console', 'Sending graceful stop command to server process...');
  proc.process.stdin?.write('stop\n');

  setTimeout(() => {
    if (activeProcesses[id]) {
      addServerLog(id, 'WARN', 'Launcher', 'Graceful shutdown timed out. Terminating process...');
      try {
        if (os.platform() === 'win32') {
          exec(`taskkill /F /PID ${proc.pid}`);
        } else {
          proc.process.kill('SIGKILL');
        }
      } catch {}
      delete activeProcesses[id];
      serverStatusMap[id] = 'offline';
    }
  }, 12000);

  res.json({ success: true });
});

app.post('/api/servers/:id/sleep', (req, res) => {
  const { id } = req.params;
  const proc = activeProcesses[id];

  serverStatusMap[id] = 'sleeping';
  addServerLog(id, 'INFO', 'HibernationProxy', '[Sleep Mode] Zero players active. Stopping server process and engaging Standby Proxy...');

  if (proc && proc.process) {
    try {
      proc.process.stdin?.write('stop\n');
      setTimeout(() => {
        if (activeProcesses[id]) {
          try {
            if (os.platform() === 'win32') {
              exec(`taskkill /F /PID ${proc.pid}`);
            } else {
              proc.process.kill('SIGKILL');
            }
          } catch {}
          delete activeProcesses[id];
        }
      }, 4000);
    } catch {}
  } else {
    delete activeProcesses[id];
  }

  try {
    const currentServers = readJsonFile<any[]>(SERVERS_FILE, []);
    const updatedServers = currentServers.map((s) => (s.id === id ? { ...s, status: 'sleeping' } : s));
    writeJsonFile(SERVERS_FILE, updatedServers);
  } catch {}

  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, status: 'sleeping' });
});

app.post('/api/servers/:id/kill', (req, res) => {
  const { id } = req.params;
  const proc = activeProcesses[id];
  if (proc) {
    addServerLog(id, 'WARN', 'Launcher', `Force killing server process (PID: ${proc.pid})...`);
    try {
      if (os.platform() === 'win32') {
        exec(`taskkill /F /PID ${proc.pid}`);
      } else {
        proc.process.kill('SIGKILL');
      }
    } catch {}
    delete activeProcesses[id];
  }
  serverStatusMap[id] = 'offline';
  res.json({ success: true });
});

app.post('/api/servers/:id/command', (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  const proc = activeProcesses[id];

  if (command) {
    addServerLog(id, 'CMD', 'User', `/${command.replace(/^\//, '')}`);
    if (proc && proc.process.stdin) {
      proc.process.stdin.write(`${command.replace(/^\//, '')}\n`);
      res.json({ success: true, executedOnProcess: true });
    } else {
      res.json({ success: true, executedOnProcess: false, note: 'Server process not active on host' });
    }
  } else {
    res.status(400).json({ error: 'Command required' });
  }
});

app.get('/api/servers/:id/logs', (req, res) => {
  const { id } = req.params;
  res.json({ logs: logsBuffer[id] || [], status: serverStatusMap[id] || (activeProcesses[id] ? 'online' : 'offline') });
});

app.get('/api/servers/:name/files', (req, res) => {
  const { name } = req.params;
  const subPath = (req.query.path as string) || '';
  const serverFolder = path.join(SERVERS_DIR, name);

  if (!fs.existsSync(serverFolder)) {
    return res.json({ files: [] });
  }

  const targetDir = path.join(serverFolder, subPath);
  if (!targetDir.startsWith(serverFolder) || !fs.existsSync(targetDir)) {
    return res.json({ files: [] });
  }

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = entries.map((entry) => {
      const fullPath = path.join(targetDir, entry.name);
      const relativePath = path.relative(serverFolder, fullPath).replace(/\\/g, '/');
      const stats = fs.statSync(fullPath);
      return {
        id: `real-${entry.name}-${stats.mtimeMs}`,
        name: entry.name,
        path: `./servers/${name}/${relativePath}`,
        isDirectory: entry.isDirectory(),
        sizeBytes: entry.isDirectory() ? 0 : stats.size,
        lastModified: stats.mtime.toISOString().replace('T', ' ').substring(0, 19),
        extension: entry.isDirectory() ? undefined : entry.name.split('.').pop(),
      };
    });
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express + Vite
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`==================================================`);
    console.log(`  MMSM - MrHaydenn's Minecraft Server Manager Wrapper`);
    console.log(`  Running WebGUI on: http://localhost:${PORT}`);
    console.log(`  Servers directory: ${SERVERS_DIR}`);
    console.log(`  Data directory:    ${DATA_DIR}`);
    console.log(`==================================================`);
  });
}

startServer();
