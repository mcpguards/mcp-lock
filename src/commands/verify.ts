import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { readLockfile, locateLockfile, lockfileExists } from '../lockfile/io.js';
import { diffEntry } from '../lockfile/diff.js';
import { fetchVersionMetadata } from '../registry/npm-api.js';
import { getAttestation } from '../registry/attestations.js';
import { generateSarif } from '../output/sarif.js';
import { renderVerifyTable } from '../output/table.js';
import { info, warn, success, error, printJson, isJsonMode } from '../output/logger.js';
import { LockfileMissingError } from '../util/errors.js';
import type { LockEntry, EntryDiff, VerifyResult } from '../lockfile/schema.js';

const CONCURRENCY = 8;

interface VerifyOptions {
  configs: string[];
  sarif?: string | undefined;
  global: boolean;
  project: boolean;
  cwd: string;
  offline: boolean;
}

async function verifyEntry(
  serverName: string,
  locked: LockEntry,
): Promise<EntryDiff> {
  if (locked.resolved.registry !== 'npm') {
    return { serverName, status: 'unlockable', changes: [] };
  }

  try {
    const meta = await fetchVersionMetadata(
      locked.resolved.name,
      locked.resolved.version,
    );
    const attestation = await getAttestation(locked.resolved.name, meta.version);

    const current: LockEntry = {
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

    return diffEntry(serverName, locked, current);
  } catch (err) {
    const isNotFound =
      err instanceof Error && err.message.includes('404');
    if (isNotFound) {
      return { serverName, status: 'missing-upstream', changes: [] };
    }
    // Re-throw network/registry errors — they'll surface as exit 3
    throw err;
  }
}

export async function runVerify(opts: VerifyOptions): Promise<void> {
  const start = Date.now();
  const cwd = resolve(opts.cwd);

  // Locate lockfile — for verify we always use cwd scope detection
  const projectLock = locateLockfile(cwd, 'project');
  const globalLock  = locateLockfile(cwd, 'global');
  let lockfilePath  = projectLock;

  if (!(await lockfileExists(projectLock))) {
    if (await lockfileExists(globalLock)) {
      lockfilePath = globalLock;
    } else {
      throw new LockfileMissingError(projectLock);
    }
  }

  if (opts.global) lockfilePath = globalLock;
  if (opts.project) lockfilePath = projectLock;

  const lock = await readLockfile(lockfilePath);
  const entries = Object.entries(lock.servers);

  if (entries.length === 0) {
    warn('Lockfile contains no servers. Run mcp-lock init.');
    process.exit(0);
  }

  info(`Verifying ${entries.length} server(s)…\n`);

  // Verify in parallel batches
  const diffs: EntryDiff[] = [];
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(([name, entry]) => verifyEntry(name, entry)),
    );
    for (const r of settled) {
      if (r.status === 'fulfilled') diffs.push(r.value);
      else throw r.reason; // propagate network errors
    }
  }

  const ok = diffs.every((d) => d.status === 'ok' || d.status === 'unlockable');
  const result: VerifyResult = {
    ok,
    diffs,
    durationMs: Date.now() - start,
    lockfilePath,
  };

  // SARIF output
  if (opts.sarif) {
    const sarif = generateSarif(diffs, lockfilePath);
    await writeFile(opts.sarif, JSON.stringify(sarif, null, 2) + '\n');
    info(`SARIF report written to ${opts.sarif}`);
  }

  if (isJsonMode()) {
    printJson(result);
    process.exit(ok ? 0 : 1);
    return;
  }

  info(renderVerifyTable(diffs, lockfilePath));

  if (ok) {
    success(`All servers verified clean in ${result.durationMs}ms`);
    process.exit(0);
  } else {
    const changed = diffs.filter((d) => d.status !== 'ok' && d.status !== 'unlockable');
    error(`${changed.length} server(s) changed since last lock.`);
    info("Run 'mcp-lock update <server>' to review and accept changes.");
    process.exit(1);
  }
}
