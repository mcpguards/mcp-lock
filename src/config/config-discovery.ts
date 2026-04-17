import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getKnownConfigPaths } from './known-paths.js';
import { parseConfigFile, type McpConfig, type McpServerEntry } from './config-parser.js';
import type { McpClient } from './known-paths.js';

export interface DiscoveredConfig extends McpConfig {
  absolutePath: string;
}

export async function discoverConfigs(cwd: string = process.cwd()): Promise<DiscoveredConfig[]> {
  const locations = getKnownConfigPaths(cwd);
  const seen = new Set<string>();
  const configs: DiscoveredConfig[] = [];

  for (const loc of locations) {
    for (const filePath of loc.paths) {
      const absolutePath = resolve(filePath);
      if (seen.has(absolutePath)) continue;
      seen.add(absolutePath);

      try {
        await access(absolutePath);
        const servers = await parseConfigFile(absolutePath, loc.client);
        if (servers.length > 0) {
          configs.push({ filePath: absolutePath, absolutePath, client: loc.client, servers });
        }
      } catch {
        // file doesn't exist or isn't readable
      }
    }
  }

  return configs;
}

export async function loadConfig(filePath: string, client: McpClient = 'custom'): Promise<DiscoveredConfig> {
  const absolutePath = resolve(filePath);
  const servers = await parseConfigFile(absolutePath, client);
  return { filePath: absolutePath, absolutePath, client, servers };
}

export function determineScope(
  configs: DiscoveredConfig[],
  cwd: string,
  forceGlobal?: boolean,
  forceProject?: boolean,
): 'project' | 'global' {
  if (forceGlobal) return 'global';
  if (forceProject) return 'project';
  const resolvedCwd = resolve(cwd);
  const hasProjectConfig = configs.some((c) => c.absolutePath.startsWith(resolvedCwd));
  return hasProjectConfig ? 'project' : 'global';
}

export function dedupeServers(configs: DiscoveredConfig[]): Array<McpServerEntry & { configPath: string }> {
  const seen = new Map<string, McpServerEntry & { configPath: string }>();
  for (const config of configs) {
    for (const server of config.servers) {
      if (!seen.has(server.name)) {
        seen.set(server.name, { ...server, configPath: config.absolutePath });
      }
    }
  }
  return Array.from(seen.values());
}
