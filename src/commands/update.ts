import { resolve } from 'node:path';
import { readLockfile, locateLockfile, writeLockfile, lockfileExists } from '../lockfile/io.js';
import { computeChecksum } from '../lockfile/checksum.js';
import { diffEntry } from '../lockfile/diff.js';
import { fetchVersionMetadata } from '../registry/npm-api.js';
import { getAttestation } from '../registry/attestations.js';
import { rewriteConfigPin } from '../config/config-writer.js';
import { renderDiffBlock } from '../output/table.js';
import { info, warn, success, error, printJson, isJsonMode } from '../output/logger.js';
import { confirm } from '../util/prompt.js';
import {
  LockfileMissingError,
  ServerNotInLockfileError,
  McpLockError,
} from '../util/errors.js';
import type { LockEntry, LockFile } from '../lockfile/schema.js';

interface UpdateOptions {
  servers: string[];
  all: boolean;
  to?: string | undefined;
  yes: boolean;
  pin: boolean;
  global: boolean;
  project: boolean;
  cwd: string;
}

async function buildUpdatedEntry(locked: LockEntry, toVersion?: string): Promise<LockEntry> {
  const version = toVersion ?? 'latest';
  const meta = await fetchVersionMetadata(locked.resolved.name, version);
  const attestation = await getAttestation(locked.resolved.name, meta.version);

  return {
    source: locked.source,
    resolved: {
      registry: 'npm',
      name: locked.resolved.name,
      version: meta.version,
      tarball: meta.dist.tarball,
      integrity: meta.dist.integrity ?? null,
      shasum: meta.dist.shasum,
      publishedAt: null,
    },
    attestation,
    lockedAt: new Date().toISOString(),
  };
}

export async function runUpdate(opts: UpdateOptions): Promise<void> {
  const cwd = resolve(opts.cwd);

  const projectLock = locateLockfile(cwd, 'project');
  const globalLock  = locateLockfile(cwd, 'global');
  let lockfilePath  = projectLock;

  if (opts.global) lockfilePath = globalLock;
  else if (opts.project) lockfilePath = projectLock;
  else if (!(await lockfileExists(projectLock)) && await lockfileExists(globalLock)) {
    lockfilePath = globalLock;
  }

  const lock = await readLockfile(lockfilePath);

  const serverNames = opts.all
    ? Object.keys(lock.servers)
    : opts.servers;

  if (serverNames.length === 0) {
    error('No server specified. Use --all to update all servers.');
    process.exit(4);
  }

  // Validate all server names exist before doing any work
  for (const name of serverNames) {
    if (!lock.servers[name]) throw new ServerNotInLockfileError(name);
  }

  const updatedEntries: Array<{ name: string; old: LockEntry; new: LockEntry }> = [];

  for (const name of serverNames) {
    const locked = lock.servers[name]!;

    if (locked.resolved.registry !== 'npm') {
      warn(`Skipping ${name} (${locked.resolved.registry} registry — not lockable)`);
      continue;
    }

    let newEntry: LockEntry;
    try {
      newEntry = await buildUpdatedEntry(locked, opts.to);
    } catch (err) {
      error(`Failed to fetch ${name}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const diff = diffEntry(name, locked, newEntry);
    if (diff.status === 'ok') {
      success(`${name} — already up to date (${locked.resolved.version})`);
      continue;
    }

    info(renderDiffBlock(name, locked, newEntry));

    if (!opts.yes) {
      const confirmed = await confirm(`Accept update for ${name}?`, false);
      if (!confirmed) {
        warn(`Skipping ${name}`);
        continue;
      }
    }

    updatedEntries.push({ name, old: locked, new: newEntry });
  }

  if (updatedEntries.length === 0) {
    info('Nothing to update.');
    return;
  }

  // Apply all accepted updates
  const updated = { ...lock.servers };
  for (const { name, new: entry } of updatedEntries) {
    updated[name] = entry;
  }

  const lockWithoutChecksum: Omit<LockFile, 'checksum'> = {
    ...lock,
    servers: updated,
    generatedAt: new Date().toISOString(),
  };

  const newLock: LockFile = {
    ...lockWithoutChecksum,
    checksum: computeChecksum(lockWithoutChecksum),
  };

  await writeLockfile(lockfilePath, newLock);

  // Pin versions if requested
  if (opts.pin) {
    for (const { name, new: entry } of updatedEntries) {
      await rewriteConfigPin(
        entry.source.configPath,
        name,
        entry.resolved.name,
        entry.resolved.version,
      );
    }
  }

  if (isJsonMode()) {
    printJson({ updated: updatedEntries.map((e) => ({ name: e.name, version: e.new.resolved.version })) });
    return;
  }

  success(`Updated ${updatedEntries.length} server(s) in ${lockfilePath}`);
}
