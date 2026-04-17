import { resolve } from 'node:path';
import { discoverConfigs, loadConfig, determineScope, dedupeServers } from '../config/config-discovery.js';
import { resolvePackage } from '../resolver/package-resolver.js';
import { fetchVersionMetadata } from '../registry/npm-api.js';
import { getAttestation } from '../registry/attestations.js';
import { computeChecksum } from '../lockfile/checksum.js';
import { locateLockfile, lockfileExists, writeLockfile } from '../lockfile/io.js';
import { rewriteConfigPin } from '../config/config-writer.js';
import { renderInitTable } from '../output/table.js';
import { info, warn, error, success, printJson, isJsonMode } from '../output/logger.js';
import { NoServersFoundError } from '../util/errors.js';
import type { LockFile, LockEntry, InitResult } from '../lockfile/schema.js';

const VERSION = '0.1.0';
const CONCURRENCY = 5;

interface InitOptions {
  configs: string[];
  pin: boolean;
  force: boolean;
  global: boolean;
  project: boolean;
  cwd: string;
}

async function buildLockEntry(
  server: ReturnType<typeof dedupeServers>[0],
): Promise<{ name: string; entry: LockEntry } | { name: string; skip: string }> {
  const resolved = resolvePackage(server);

  if (resolved.registry !== 'npm') {
    return { name: server.name, skip: `${resolved.registry} registry — not lockable` };
  }

  try {
    const meta = await fetchVersionMetadata(resolved.packageName, resolved.version);
    const attestation = await getAttestation(resolved.packageName, meta.version);

    const entry: LockEntry = {
      source: {
        command: server.command,
        args: server.args,
        configPath: server.configPath,
      },
      resolved: {
        registry: 'npm',
        name: resolved.packageName,
        version: meta.version,
        tarball: meta.dist.tarball,
        integrity: meta.dist.integrity ?? null,
        shasum: meta.dist.shasum,
        publishedAt: null,
      },
      attestation,
      lockedAt: new Date().toISOString(),
    };

    return { name: server.name, entry };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: server.name, skip: `registry error: ${msg}` };
  }
}

export async function runInit(opts: InitOptions): Promise<void> {
  const cwd = resolve(opts.cwd);

  // 1. Discover configs
  let configs;
  if (opts.configs.length > 0) {
    configs = await Promise.all(opts.configs.map((c) => loadConfig(c)));
  } else {
    configs = await discoverConfigs(cwd);
  }

  if (configs.length === 0) {
    throw new NoServersFoundError();
  }

  const servers = dedupeServers(configs);
  if (servers.length === 0) throw new NoServersFoundError();

  info(`Found ${servers.length} server(s) across ${configs.length} config(s)\n`);

  // 2. Determine lockfile location
  const scope = determineScope(configs, cwd, opts.global, opts.project);
  const lockfilePath = locateLockfile(cwd, scope);

  if (await lockfileExists(lockfilePath) && !opts.force) {
    error(`Lockfile already exists at ${lockfilePath}`);
    info("Use --force to overwrite, or run 'mcp-lock update' to update individual servers.");
    process.exit(4);
  }

  // 3. Resolve + lock all servers (with concurrency limit)
  const buildResults: Array<{ name: string; entry: LockEntry } | { name: string; skip: string }> = [];

  for (let i = 0; i < servers.length; i += CONCURRENCY) {
    const batch = servers.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(buildLockEntry));
    for (const r of settled) {
      if (r.status === 'fulfilled') buildResults.push(r.value);
    }
  }

  const entries: Array<{ name: string; entry: LockEntry }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const r of buildResults) {
    if ('entry' in r) entries.push(r);
    else skipped.push({ name: r.name, reason: r.skip });
  }

  if (entries.length === 0) {
    warn('No lockable servers found (all were non-npm or failed to resolve).');
    process.exit(0);
  }

  // 4. Build lockfile (no checksum yet)
  const serversMap: Record<string, LockEntry> = {};
  for (const { name, entry } of entries) serversMap[name] = entry;

  const lockWithoutChecksum: Omit<LockFile, 'checksum'> = {
    lockfileVersion: 1,
    generatedBy: `mcp-lock@${VERSION}`,
    generatedAt: new Date().toISOString(),
    scope,
    servers: serversMap,
  };

  const lock: LockFile = {
    ...lockWithoutChecksum,
    checksum: computeChecksum(lockWithoutChecksum),
  };

  // 5. Write atomically
  await writeLockfile(lockfilePath, lock);

  // 6. Pin versions in configs if requested
  const pinnedConfigs: string[] = [];
  if (opts.pin) {
    for (const { name, entry } of entries) {
      const pinned = await rewriteConfigPin(
        entry.source.configPath,
        name,
        entry.resolved.name,
        entry.resolved.version,
      );
      if (pinned && !pinnedConfigs.includes(entry.source.configPath)) {
        pinnedConfigs.push(entry.source.configPath);
      }
    }
  }

  // 7. Output
  const result: InitResult = { lockfilePath, entries, skipped, pinnedConfigs };

  if (isJsonMode()) {
    printJson(result);
    return;
  }

  info(renderInitTable(entries, skipped));
  success(`Lockfile written to ${lockfilePath}`);

  if (opts.pin && pinnedConfigs.length > 0) {
    info(`Version pins added to: ${pinnedConfigs.join(', ')}`);
  } else if (!opts.pin && entries.length > 0) {
    info(`Tip: Run with --pin to add version pins to your MCP configs for extra security.`);
  }
}
