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

if (!fs.existsSync(SERVERS_DIR)) fs.mkdirSync(SERVERS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// Process registry
interface ServerProcess {
  process: ChildProcess;
  serverId: string;
  serverName: string;
  port: number;
  pid: number;
  startedAt: string;
}

const activeProcesses: Record<string, ServerProcess> = {};
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

// Helper to download files
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = (url.startsWith('https') ? https : http).get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    request.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// 1. System Info API
app.get('/api/system/info', (req, res) => {
  const totalMemGb = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeMemGb = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const cpuCores = os.cpus().length;
  res.json({
    totalMemGb,
    freeMemGb,
    cpuCores,
    platform: os.platform(),
    serversDirectory: SERVERS_DIR,
    backupsDirectory: BACKUPS_DIR,
  });
});

// 2. Active Processes Status API
app.get('/api/servers/running', (req, res) => {
  const running = Object.keys(activeProcesses).map((id) => ({
    serverId: id,
    serverName: activeProcesses[id].serverName,
    port: activeProcesses[id].port,
    pid: activeProcesses[id].pid,
    startedAt: activeProcesses[id].startedAt,
  }));
  res.json({ running });
});

// 3. Start Server API
app.post('/api/servers/:id/start', async (req, res) => {
  const { id } = req.params;
  const {
    name = 'Minecraft Server',
    port = 25565,
    minRamMb = 1024,
    ramMb = 2048,
    loader = 'fabric',
    minecraftVersion = '1.21.4',
  } = req.body;

  const serverFolder = path.join(SERVERS_DIR, name);
  if (!fs.existsSync(serverFolder)) fs.mkdirSync(serverFolder, { recursive: true });

  // Ensure eula.txt
  const eulaPath = path.join(serverFolder, 'eula.txt');
  if (!fs.existsSync(eulaPath)) {
    fs.writeFileSync(eulaPath, '#Accepted via MMSM\neula=true\n');
  }

  // Ensure server.properties
  const propsPath = path.join(serverFolder, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    const propsContent = `#Minecraft server properties\nserver-port=${port}\nserver-ip=\nmax-players=20\nonline-mode=true\nlevel-name=world\nmotd=${name}\nenable-rcon=false\n`;
    fs.writeFileSync(propsPath, propsContent);
  } else {
    let content = fs.readFileSync(propsPath, 'utf-8');
    if (content.includes('server-port=')) {
      content = content.replace(/^server-port=.*$/m, `server-port=${port}`);
    } else {
      content += `\nserver-port=${port}`;
    }
    content = content.replace(/^server-ip=.*$/m, 'server-ip=');
    fs.writeFileSync(propsPath, content);
  }

  // If already running
  if (activeProcesses[id] && !activeProcesses[id].process.killed) {
    return res.json({ success: true, message: 'Server is already running', pid: activeProcesses[id].pid });
  }

  addServerLog(id, 'INFO', 'Launcher', `Initializing process for "${name}" on port ${port}...`);
  addServerLog(id, 'INFO', 'Launcher', `Directory: ${serverFolder}`);

  const jarPath = path.join(serverFolder, 'server.jar');

  // Download server JAR if missing
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
        // Fallback / Vanilla
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

  // Check if Java is available
  exec('java -version', (err) => {
    if (err) {
      addServerLog(id, 'ERROR', 'Launcher', 'Java executable (java.exe) was not found in system PATH. Please install Java 21 JDK or OpenJDK.');
      return res.status(500).json({
        success: false,
        error: 'Java is not installed or not added to system PATH on this host machine. Please install Java 21 JDK.',
      });
    }

    const xms = `${minRamMb || 1024}M`;
    const xmx = `${ramMb || 2048}M`;

    addServerLog(id, 'INFO', 'Launcher', `Spawning Java process: java -Xms${xms} -Xmx${xmx} -jar server.jar nogui`);

    try {
      const child = spawn('java', [`-Xms${xms}`, `-Xmx${xmx}`, '-jar', 'server.jar', 'nogui'], {
        cwd: serverFolder,
        shell: true,
      });

      if (!child.pid) {
        addServerLog(id, 'ERROR', 'Launcher', 'Failed to acquire process PID.');
        return res.status(500).json({ success: false, error: 'Failed to spawn process' });
      }

      activeProcesses[id] = {
        process: child,
        serverId: id,
        serverName: name,
        port: Number(port),
        pid: child.pid,
        startedAt: new Date().toISOString(),
      };

      addServerLog(id, 'INFO', 'Launcher', `Server process running (PID: ${child.pid}). Listening on port ${port}.`);

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
        addServerLog(id, 'INFO', 'System', `Server process stopped with exit code ${code}`);
        delete activeProcesses[id];
      });

      child.on('error', (procErr) => {
        addServerLog(id, 'ERROR', 'System', `Process error: ${procErr.message}`);
        delete activeProcesses[id];
      });

      res.json({ success: true, pid: child.pid, port: Number(port) });
    } catch (spawnErr: any) {
      addServerLog(id, 'ERROR', 'Launcher', `Spawn exception: ${spawnErr.message}`);
      res.status(500).json({ success: false, error: spawnErr.message });
    }
  });
});

// 4. Stop Server API
app.post('/api/servers/:id/stop', (req, res) => {
  const { id } = req.params;
  const proc = activeProcesses[id];
  if (!proc) {
    return res.json({ success: true, message: 'Server is not running' });
  }

  addServerLog(id, 'INFO', 'Console', 'Sending graceful stop command to server process...');
  proc.process.stdin?.write('stop\n');

  // Fallback kill timeout after 12s
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
    }
  }, 12000);

  res.json({ success: true });
});

// 5. Kill Server API
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
  res.json({ success: true });
});

// 6. Execute Console Command API
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

// 7. Get Server Logs API
app.get('/api/servers/:id/logs', (req, res) => {
  const { id } = req.params;
  res.json({ logs: logsBuffer[id] || [] });
});

// 8. Real File Manager API
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
    console.log(`==================================================`);
  });
}

startServer();
