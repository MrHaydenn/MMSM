import { ModrinthSearchResult, ModrinthVersion } from '../types/server';

const MODRINTH_BASE_URL = 'https://api.modrinth.com/v2';
const USER_AGENT = 'CraftyForge-Wrapper/1.0.0 (https://github.com/craftyforge/wrapper)';

// Fallback curated popular mods in case of network throttle or offline dev
const POPULAR_MODS_FALLBACK: ModrinthSearchResult[] = [
  {
    project_id: 'AANobbMI',
    slug: 'sodium',
    author: 'jellysquid3',
    title: 'Sodium',
    description: 'A modern, open-source optimization engine for Minecraft that greatly improves frame rates and reduces stutter.',
    categories: ['optimization'],
    display_categories: ['optimization'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 38400000,
    follows: 195000,
    icon_url: 'https://cdn.modrinth.com/data/AANobbMI/icon.png',
    date_created: '2020-04-06T00:00:00Z',
    date_modified: '2024-12-10T00:00:00Z',
    latest_version: '0.6.6',
    license: 'LGPL-3.0',
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: 'gvQqBUqZ',
    slug: 'lithium',
    author: 'jellysquid3',
    title: 'Lithium',
    description: 'A modern, general-purpose optimization mod for Minecraft which works on both client and server to boost tick rates (TPS).',
    categories: ['optimization'],
    display_categories: ['optimization'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 29500000,
    follows: 142000,
    icon_url: 'https://cdn.modrinth.com/data/gvQqBUqZ/icon.png',
    date_created: '2020-04-06T00:00:00Z',
    date_modified: '2024-12-05T00:00:00Z',
    latest_version: '0.14.7',
    license: 'LGPL-3.0',
    client_side: 'optional',
    server_side: 'required',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: 'P7dR8mSH',
    slug: 'fabric-api',
    author: 'FabricMC',
    title: 'Fabric API',
    description: 'Essential hooks and compatibility layer for mods using the Fabric loader.',
    categories: ['library'],
    display_categories: ['library'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 51200000,
    follows: 210000,
    icon_url: 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png',
    date_created: '2020-04-06T00:00:00Z',
    date_modified: '2024-12-15T00:00:00Z',
    latest_version: '0.110.1+1.21.4',
    license: 'Apache-2.0',
    client_side: 'optional',
    server_side: 'optional',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: 'YL57xq9U',
    slug: 'iris',
    author: 'IrisShaders',
    title: 'Iris Shaders',
    description: 'A modern shader mod for Minecraft compatible with existing OptiFine shader packs.',
    categories: ['shaders'],
    display_categories: ['shaders'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 32000000,
    follows: 160000,
    icon_url: 'https://cdn.modrinth.com/data/YL57xq9U/icon.png',
    date_created: '2021-01-01T00:00:00Z',
    date_modified: '2024-12-12T00:00:00Z',
    latest_version: '1.8.0',
    license: 'LGPL-3.0',
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: 'mOgUt4GM',
    slug: 'modmenu',
    author: 'TerraformersMC',
    title: 'Mod Menu',
    description: 'Adds a screen for viewing a list of installed mods and customizing their configs.',
    categories: ['utility'],
    display_categories: ['utility'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 24500000,
    follows: 98000,
    icon_url: 'https://cdn.modrinth.com/data/mOgUt4GM/icon.png',
    date_created: '2020-04-06T00:00:00Z',
    date_modified: '2024-12-08T00:00:00Z',
    latest_version: '11.0.2',
    license: 'MIT',
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: 'nk8j3m9o',
    slug: 'chunky',
    author: 'pop4959',
    title: 'Chunky',
    description: 'Pre-generates chunks rapidly to reduce server lag during exploration.',
    categories: ['optimization', 'utility'],
    display_categories: ['optimization'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 8700000,
    follows: 45000,
    icon_url: 'https://cdn.modrinth.com/data/fALzjRMS/icon.png',
    date_created: '2020-04-06T00:00:00Z',
    date_modified: '2024-12-01T00:00:00Z',
    latest_version: '1.4.28',
    license: 'GPL-3.0',
    client_side: 'optional',
    server_side: 'required',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: 'u6dsqVyZ',
    slug: 'ferrite-core',
    author: 'malte0811',
    title: 'FerriteCore',
    description: 'Memory usage optimizations for Minecraft server and client, reducing RAM by up to 40%.',
    categories: ['optimization'],
    display_categories: ['optimization'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 21000000,
    follows: 82000,
    icon_url: 'https://cdn.modrinth.com/data/u6dsqVyZ/icon.png',
    date_created: '2021-03-01T00:00:00Z',
    date_modified: '2024-12-14T00:00:00Z',
    latest_version: '7.0.0',
    license: 'MIT',
    client_side: 'optional',
    server_side: 'required',
    project_type: 'mod',
    gallery: [],
  },
  {
    project_id: '1KtxHfUr',
    slug: 'fabulously-optimized',
    author: 'RobotKoer',
    title: 'Fabulously Optimized',
    description: 'A simple Minecraft modpack focusing on boosting performance, graphics, and quality of life.',
    categories: ['optimization'],
    display_categories: ['modpack'],
    versions: ['1.21.4', '1.21.1', '1.20.4'],
    downloads: 6200000,
    follows: 62000,
    icon_url: 'https://cdn.modrinth.com/data/1KtxHfUr/icon.png',
    date_created: '2021-02-01T00:00:00Z',
    date_modified: '2024-12-16T00:00:00Z',
    latest_version: '6.0.0-beta.2',
    license: 'CC0-1.0',
    client_side: 'required',
    server_side: 'optional',
    project_type: 'modpack',
    gallery: [],
  },
  {
    project_id: 'clGZ4fV2',
    slug: 'cobblemon-official',
    author: 'Cobblemon',
    title: 'Cobblemon Official Modpack',
    description: 'The official Pokémon modpack featuring high-quality Pokémon models, smooth animations, and deep survival gameplay.',
    categories: ['adventure'],
    display_categories: ['modpack'],
    versions: ['1.21.1', '1.20.1'],
    downloads: 4100000,
    follows: 48000,
    icon_url: 'https://cdn.modrinth.com/data/clGZ4fV2/icon.png',
    date_created: '2022-05-01T00:00:00Z',
    date_modified: '2024-11-20T00:00:00Z',
    latest_version: '1.5.2',
    license: 'All-Rights-Reserved',
    client_side: 'required',
    server_side: 'required',
    project_type: 'modpack',
    gallery: [],
  }
];

export interface ModrinthSearchOptions {
  query?: string;
  projectType?: 'mod' | 'modpack' | 'plugin';
  loader?: string; // 'fabric' | 'neoforge' | 'forge' | 'paper'
  gameVersion?: string;
  sortBy?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
  category?: string;
  limit?: number;
  offset?: number;
}

export async function searchModrinth(options: ModrinthSearchOptions): Promise<{
  hits: ModrinthSearchResult[];
  total_hits: number;
  offset: number;
  limit: number;
}> {
  const facets: string[][] = [];

  if (options.projectType) {
    facets.push([`project_type:${options.projectType}`]);
  }
  if (options.loader) {
    // Some loaders like Paper/Purpur match 'paper' or 'purpur' or 'bukkit'
    const loaderParam = options.loader.toLowerCase();
    facets.push([`categories:${loaderParam}`]);
  }
  if (options.gameVersion) {
    facets.push([`versions:${options.gameVersion}`]);
  }
  if (options.category) {
    facets.push([`categories:${options.category}`]);
  }

  const params = new URLSearchParams();
  if (options.query) params.set('query', options.query);
  if (facets.length > 0) params.set('facets', JSON.stringify(facets));
  if (options.sortBy) {
    const indexMap: Record<string, string> = {
      relevance: 'relevance',
      downloads: 'downloads',
      follows: 'follows',
      newest: 'newest',
      updated: 'updated',
    };
    params.set('index', indexMap[options.sortBy] || 'downloads');
  } else {
    params.set('index', 'downloads');
  }

  const limit = options.limit || 20;
  params.set('limit', limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());

  try {
    const response = await fetch(`${MODRINTH_BASE_URL}/search?${params.toString()}`, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Modrinth API responded with status ${response.status}`);
    }

    const data = await response.json();
    return {
      hits: data.hits || [],
      total_hits: data.total_hits || 0,
      offset: data.offset || 0,
      limit: data.limit || limit,
    };
  } catch (err) {
    console.warn('Modrinth API live search error, using client-side fallback list:', err);
    // Filter fallback data gracefully
    let hits = [...POPULAR_MODS_FALLBACK];
    if (options.projectType) {
      hits = hits.filter((h) => h.project_type === options.projectType);
    }
    if (options.query) {
      const q = options.query.toLowerCase();
      hits = hits.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.slug.toLowerCase().includes(q)
      );
    }
    return {
      hits,
      total_hits: hits.length,
      offset: 0,
      limit,
    };
  }
}

export async function getModrinthProject(idOrSlug: string): Promise<ModrinthSearchResult | null> {
  try {
    const res = await fetch(`${MODRINTH_BASE_URL}/project/${encodeURIComponent(idOrSlug)}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch project ${idOrSlug}:`, err);
    return POPULAR_MODS_FALLBACK.find((m) => m.project_id === idOrSlug || m.slug === idOrSlug) || null;
  }
}

export async function getProjectVersions(
  idOrSlug: string,
  loaders?: string[],
  gameVersions?: string[]
): Promise<ModrinthVersion[]> {
  try {
    const params = new URLSearchParams();
    if (loaders && loaders.length > 0) {
      params.set('loaders', JSON.stringify(loaders.map((l) => l.toLowerCase())));
    }
    if (gameVersions && gameVersions.length > 0) {
      params.set('game_versions', JSON.stringify(gameVersions));
    }

    const url = `${MODRINTH_BASE_URL}/project/${encodeURIComponent(idOrSlug)}/version?${params.toString()}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn(`Error getting versions for ${idOrSlug}:`, err);
    return [];
  }
}

export async function checkModUpdate(
  projectId: string,
  currentVersionNumber: string,
  loader: string,
  gameVersion: string
): Promise<{ hasUpdate: boolean; latestVersion?: ModrinthVersion }> {
  try {
    const versions = await getProjectVersions(projectId, [loader], [gameVersion]);
    if (!versions || versions.length === 0) {
      return { hasUpdate: false };
    }

    // Pick first release or latest valid version
    const latestRelease = versions.find((v) => v.version_type === 'release') || versions[0];
    if (latestRelease && latestRelease.version_number !== currentVersionNumber) {
      return {
        hasUpdate: true,
        latestVersion: latestRelease,
      };
    }
    return { hasUpdate: false };
  } catch {
    return { hasUpdate: false };
  }
}
