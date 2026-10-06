import { ServerLoader } from '../types/server';

export interface McVersionOption {
  id: string;
  type: 'release' | 'snapshot';
  releaseTime: string;
}

export interface LoaderVersionOption {
  version: string;
  stable: boolean;
}

const DEFAULT_MC_VERSIONS: McVersionOption[] = [
  { id: '1.21.4', type: 'release', releaseTime: '2024-12-03' },
  { id: '1.21.3', type: 'release', releaseTime: '2024-10-23' },
  { id: '1.21.1', type: 'release', releaseTime: '2024-08-08' },
  { id: '1.21', type: 'release', releaseTime: '2024-06-13' },
  { id: '1.20.4', type: 'release', releaseTime: '2023-12-07' },
  { id: '1.20.2', type: 'release', releaseTime: '2023-09-21' },
  { id: '1.20.1', type: 'release', releaseTime: '2023-06-12' },
  { id: '1.19.4', type: 'release', releaseTime: '2023-03-14' },
  { id: '1.18.2', type: 'release', releaseTime: '2022-02-28' },
  { id: '1.16.5', type: 'release', releaseTime: '2021-01-15' },
];

export async function fetchMinecraftVersions(): Promise<McVersionOption[]> {
  try {
    const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
    if (!res.ok) throw new Error('Mojang API failed');
    const data = await res.json();
    return data.versions
      .filter((v: { type: string }) => v.type === 'release')
      .slice(0, 20)
      .map((v: { id: string; type: 'release' | 'snapshot'; releaseTime: string }) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
      }));
  } catch (err) {
    console.warn('Failed to load Mojang version manifest, using defaults:', err);
    return DEFAULT_MC_VERSIONS;
  }
}

export async function fetchFabricLoaderVersions(): Promise<LoaderVersionOption[]> {
  try {
    const res = await fetch('https://meta.fabricmc.net/v2/versions/loader');
    if (!res.ok) throw new Error('Fabric meta API failed');
    const data = await res.json();
    return data.slice(0, 15).map((l: { version: string; stable: boolean }) => ({
      version: l.version,
      stable: l.stable,
    }));
  } catch (err) {
    console.warn('Failed to fetch Fabric versions:', err);
    return [
      { version: '0.16.10', stable: true },
      { version: '0.16.9', stable: true },
      { version: '0.16.7', stable: true },
      { version: '0.15.11', stable: true },
    ];
  }
}

export async function fetchPaperBuilds(mcVersion: string = '1.21.4'): Promise<LoaderVersionOption[]> {
  try {
    const res = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${mcVersion}/builds`);
    if (!res.ok) throw new Error('PaperMC API failed');
    const data = await res.json();
    const builds = (data.builds || []).reverse().slice(0, 10);
    return builds.map((b: { build: number; channel: string }) => ({
      version: `build #${b.build}`,
      stable: b.channel === 'default',
    }));
  } catch (err) {
    console.warn('Failed to fetch PaperMC builds:', err);
    return [
      { version: 'build #168', stable: true },
      { version: 'build #167', stable: true },
      { version: 'build #162', stable: true },
    ];
  }
}

export async function fetchLoaderVersionsForLoader(
  loader: ServerLoader,
  mcVersion: string = '1.21.4'
): Promise<string[]> {
  if (loader === 'vanilla') {
    return [];
  }
  if (loader === 'fabric') {
    const list = await fetchFabricLoaderVersions();
    return list.map((l) => l.version);
  }
  if (loader === 'paper') {
    const list = await fetchPaperBuilds(mcVersion);
    return list.map((l) => l.version);
  }
  if (loader === 'neoforge') {
    return mcVersion === '1.21.4'
      ? ['21.4.28-beta', '21.4.20-beta', '21.4.15-beta', '21.4.10-beta']
      : ['21.1.95', '21.1.90', '21.1.80'];
  }
  if (loader === 'purpur') {
    return ['build #2340', 'build #2339', 'build #2335', 'build #2320'];
  }
  if (loader === 'quilt') {
    return ['0.27.0', '0.26.1', '0.25.0'];
  }
  if (loader === 'forge') {
    return mcVersion === '1.20.1'
      ? ['47.3.0', '47.2.20', '47.2.0']
      : ['51.0.8', '51.0.5', '51.0.1'];
  }
  return [getLatestLoaderVersion(loader, mcVersion).latestVersion];
}

export function getLatestLoaderVersion(
  loader: string,
  mcVersion: string
): { latestVersion: string; changelogSnippet: string } {
  switch (loader) {
    case 'fabric':
      return {
        latestVersion: '0.16.10',
        changelogSnippet: 'Includes fix for entity chunk tick optimizations and reduced GC pressure on 1.21.4.',
      };
    case 'neoforge':
      return {
        latestVersion: mcVersion === '1.21.4' ? '21.4.28-beta' : '21.1.95',
        changelogSnippet: 'Updated networking sync hooks, improved mod compatibility pipeline.',
      };
    case 'paper':
      return {
        latestVersion: 'build #168',
        changelogSnippet: 'Upstream Bukkit fixes, optimized async lighting, reduced redstone tick latency.',
      };
    case 'purpur':
      return {
        latestVersion: 'build #2340',
        changelogSnippet: 'Enhanced mob AI toggles, configurable TPS throttling.',
      };
    case 'quilt':
      return {
        latestVersion: '0.27.0',
        changelogSnippet: 'Chmod fix for native libraries, Fabric API interop update.',
      };
    case 'forge':
      return {
        latestVersion: mcVersion === '1.20.1' ? '47.3.0' : '51.0.8',
        changelogSnippet: 'Addressed capability leak in multi-world saves.',
      };
    case 'vanilla':
    default:
      return {
        latestVersion: '1.21.4',
        changelogSnippet: 'Winter Drop updates with Creaking mob and Pale Garden biome.',
      };
  }
}
