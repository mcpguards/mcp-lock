import type { McpServerEntry } from '../config/config-parser.js';

export interface ResolvedPackage {
  serverName: string;
  registry: 'npm' | 'pypi' | 'docker' | 'url' | 'local' | 'unknown';
  packageName: string;
  version: string;
  isPinned: boolean;
  rawCommand: string;
  configPath: string;
}

function parsePackageSpec(spec: string): { packageName: string; version: string; isPinned: boolean } {
  // Handle scoped packages: @scope/name@version
  const scopedMatch = spec.match(/^(@[^@/]+\/[^@]+)@(.+)$/);
  if (scopedMatch) {
    return { packageName: scopedMatch[1]!, version: scopedMatch[2]!, isPinned: true };
  }

  // Handle unscoped: name@version
  const unscopedMatch = spec.match(/^([^@][^@]*)@(.+)$/);
  if (unscopedMatch) {
    return { packageName: unscopedMatch[1]!, version: unscopedMatch[2]!, isPinned: true };
  }

  return { packageName: spec, version: 'latest', isPinned: false };
}

export function resolveNpmPackage(
  server: McpServerEntry & { configPath: string },
): ResolvedPackage | null {
  const { name, command, args = [], configPath } = server;
  const rawCommand = [command, ...args].join(' ');

  if (command === 'npx' || command === 'bunx') {
    const filtered = args.filter(
      (a) => a !== '-y' && a !== '--yes' && !a.startsWith('-'),
    );
    const packageArg = filtered[0];
    if (!packageArg) return null;

    const { packageName, version, isPinned } = parsePackageSpec(packageArg);
    return { serverName: name, registry: 'npm', packageName, version, isPinned, rawCommand, configPath };
  }

  if (command === 'node') {
    const mainArg = args[0];
    if (mainArg?.includes('node_modules')) {
      const match = mainArg.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
      if (match) {
        return {
          serverName: name,
          registry: 'npm',
          packageName: match[1]!,
          version: 'installed',
          isPinned: false,
          rawCommand,
          configPath,
        };
      }
    }
  }

  return null;
}
