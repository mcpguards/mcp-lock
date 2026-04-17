import { platform, homedir } from 'node:os';
import { join } from 'node:path';

export type McpClient =
  | 'claude-desktop'
  | 'claude-code'
  | 'cursor'
  | 'vscode'
  | 'windsurf'
  | 'amazon-q'
  | 'cline'
  | 'gemini-cli'
  | 'custom';

export interface ConfigLocation {
  client: McpClient;
  paths: string[];
}

export function getKnownConfigPaths(cwd: string = process.cwd()): ConfigLocation[] {
  const home = homedir();
  const os = platform();

  const locations: ConfigLocation[] = [
    {
      client: 'claude-desktop',
      paths:
        os === 'darwin'
          ? [join(home, 'Library/Application Support/Claude/claude_desktop_config.json')]
          : os === 'win32'
            ? [join(home, 'AppData/Roaming/Claude/claude_desktop_config.json')]
            : [join(home, '.config/Claude/claude_desktop_config.json')],
    },
    {
      client: 'claude-code',
      paths: [
        join(home, '.claude.json'),
        join(home, '.claude', 'settings.json'),
      ],
    },
    {
      client: 'cursor',
      paths: [join(home, '.cursor', 'mcp.json')],
    },
    {
      client: 'vscode',
      paths:
        os === 'darwin'
          ? [join(home, 'Library/Application Support/Code/User/settings.json')]
          : os === 'win32'
            ? [join(home, 'AppData/Roaming/Code/User/settings.json')]
            : [join(home, '.config/Code/User/settings.json')],
    },
    {
      client: 'windsurf',
      paths: [
        join(home, '.windsurf', 'mcp.json'),
        join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      ],
    },
    {
      client: 'amazon-q',
      paths: [join(home, '.aws', 'amazonq', 'mcp.json')],
    },
    {
      client: 'gemini-cli',
      paths: [join(home, '.gemini', 'settings.json')],
    },
    {
      client: 'custom',
      paths: [
        join(cwd, '.mcp.json'),
        join(cwd, 'mcp.json'),
        join(cwd, '.mcp', 'config.json'),
      ],
    },
  ];

  return locations;
}
