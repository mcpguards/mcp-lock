import type { McpServerEntry } from '../config/config-parser.js';
import { resolveNpmPackage, type ResolvedPackage } from './npm-resolver.js';

export type { ResolvedPackage };

export function resolvePackage(
  server: McpServerEntry & { configPath: string },
): ResolvedPackage {
  const { name, command, args = [], configPath } = server;
  const rawCommand = [command, ...args].join(' ');

  const npmResult = resolveNpmPackage(server);
  if (npmResult) return npmResult;

  if (command === 'uvx' || command === 'pipx') {
    const pkgArg = args.find((a) => !a.startsWith('-'));
    return {
      serverName: name,
      registry: 'pypi',
      packageName: pkgArg ?? 'unknown',
      version: 'latest',
      isPinned: false,
      rawCommand,
      configPath,
    };
  }

  if (command === 'docker') {
    const imageArg = args.find((a) => !a.startsWith('-'));
    return {
      serverName: name,
      registry: 'docker',
      packageName: imageArg ?? 'unknown',
      version: 'latest',
      isPinned: false,
      rawCommand,
      configPath,
    };
  }

  if (server.url) {
    return {
      serverName: name,
      registry: 'url',
      packageName: server.url,
      version: 'n/a',
      isPinned: false,
      rawCommand: server.url,
      configPath,
    };
  }

  if (command.startsWith('/') || command.startsWith('.')) {
    return {
      serverName: name,
      registry: 'local',
      packageName: command,
      version: 'local',
      isPinned: false,
      rawCommand,
      configPath,
    };
  }

  return {
    serverName: name,
    registry: 'unknown',
    packageName: command,
    version: 'unknown',
    isPinned: false,
    rawCommand,
    configPath,
  };
}
