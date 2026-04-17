import { readFile } from 'node:fs/promises';
import type { McpClient } from './known-paths.js';

export interface McpServerEntry {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  url?: string | undefined;
}

export interface McpConfig {
  filePath: string;
  client: McpClient;
  servers: McpServerEntry[];
}

function stripJsoncComments(raw: string): string {
  return raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
}

function extractServers(json: unknown): McpServerEntry[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const obj = json as Record<string, unknown>;

  let serversObj: Record<string, unknown> | undefined;

  if (obj['mcpServers'] && typeof obj['mcpServers'] === 'object' && !Array.isArray(obj['mcpServers'])) {
    serversObj = obj['mcpServers'] as Record<string, unknown>;
  } else if (obj['mcp'] && typeof obj['mcp'] === 'object' && !Array.isArray(obj['mcp'])) {
    const mcp = obj['mcp'] as Record<string, unknown>;
    if (mcp['servers'] && typeof mcp['servers'] === 'object' && !Array.isArray(mcp['servers'])) {
      serversObj = mcp['servers'] as Record<string, unknown>;
    }
  } else if (obj['servers'] && typeof obj['servers'] === 'object' && !Array.isArray(obj['servers'])) {
    serversObj = obj['servers'] as Record<string, unknown>;
  }

  if (!serversObj) return [];

  return Object.entries(serversObj).map(([name, value]) => {
    const entry = (value ?? {}) as Record<string, unknown>;
    return {
      name,
      command: typeof entry['command'] === 'string' ? entry['command'] : '',
      args: Array.isArray(entry['args']) ? (entry['args'] as string[]) : [],
      env: (typeof entry['env'] === 'object' && entry['env'] !== null && !Array.isArray(entry['env']))
        ? (entry['env'] as Record<string, string>)
        : {},
      url: typeof entry['url'] === 'string' ? entry['url'] : undefined,
    };
  });
}

export async function parseConfigFile(filePath: string, _client: McpClient): Promise<McpServerEntry[]> {
  const raw = await readFile(filePath, 'utf-8');
  const cleaned = stripJsoncComments(raw);

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return [];
  }

  return extractServers(json);
}

export { stripJsoncComments, extractServers };
