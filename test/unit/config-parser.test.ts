import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractServers, stripJsoncComments } from '../../src/config/config-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures/configs');

describe('config-parser', () => {
  it('parses claude_desktop mcpServers format', async () => {
    const raw = await readFile(join(FIXTURES, 'claude_desktop.json'), 'utf-8');
    const servers = extractServers(JSON.parse(raw));
    expect(servers).toHaveLength(3);
    expect(servers.map((s) => s.name)).toEqual(['filesystem', 'github', 'pinned']);
  });

  it('parses VS Code mcp.servers format', async () => {
    const raw = await readFile(join(FIXTURES, 'vscode.json'), 'utf-8');
    const servers = extractServers(JSON.parse(raw));
    expect(servers).toHaveLength(1);
    expect(servers[0]!.name).toBe('filesystem');
  });

  it('strips JSONC comments before parsing', async () => {
    const raw = await readFile(join(FIXTURES, 'with-comments.jsonc'), 'utf-8');
    const cleaned = stripJsoncComments(raw);
    const servers = extractServers(JSON.parse(cleaned));
    expect(servers).toHaveLength(2);
    expect(servers.map((s) => s.name)).toEqual(['filesystem', 'python-server']);
  });

  it('returns empty array for unknown format', () => {
    const servers = extractServers({ unknownKey: {} });
    expect(servers).toHaveLength(0);
  });

  it('returns empty array for null input', () => {
    expect(extractServers(null)).toHaveLength(0);
  });
});
