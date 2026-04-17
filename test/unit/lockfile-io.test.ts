import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeLockfile, readLockfile, lockfileExists, locateLockfile } from '../../src/lockfile/io.js';
import { computeChecksum } from '../../src/lockfile/checksum.js';
import { LockfileMissingError, LockfileTamperedError } from '../../src/util/errors.js';
import type { LockFile } from '../../src/lockfile/schema.js';

function makeValidLock(): LockFile {
  const base: Omit<LockFile, 'checksum'> = {
    lockfileVersion: 1,
    generatedBy: 'mcp-lock@0.1.0',
    generatedAt: '2026-04-16T12:00:00.000Z',
    scope: 'project',
    servers: {},
  };
  return { ...base, checksum: computeChecksum(base) };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'mcp-lock-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('lockfile io', () => {
  it('writes and reads a valid lockfile', async () => {
    const lock = makeValidLock();
    const path = join(tmpDir, '.mcp.lock');
    await writeLockfile(path, lock);
    const read = await readLockfile(path);
    expect(read.lockfileVersion).toBe(1);
    expect(read.checksum).toBe(lock.checksum);
  });

  it('throws LockfileMissingError for non-existent file', async () => {
    await expect(readLockfile(join(tmpDir, 'missing.lock'))).rejects.toThrow(LockfileMissingError);
  });

  it('throws LockfileTamperedError for wrong checksum', async () => {
    const lock = makeValidLock();
    const tampered = { ...lock, checksum: 'sha256-wrongvalue' };
    const path = join(tmpDir, '.mcp.lock');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, JSON.stringify(tampered, null, 2));
    await expect(readLockfile(path)).rejects.toThrow(LockfileTamperedError);
  });

  it('throws LockfileTamperedError for invalid JSON', async () => {
    const path = join(tmpDir, '.mcp.lock');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, '{ invalid json }');
    await expect(readLockfile(path)).rejects.toThrow(LockfileTamperedError);
  });

  it('lockfileExists returns true/false correctly', async () => {
    const path = join(tmpDir, '.mcp.lock');
    expect(await lockfileExists(path)).toBe(false);
    await writeLockfile(path, makeValidLock());
    expect(await lockfileExists(path)).toBe(true);
  });

  it('locateLockfile returns correct paths', () => {
    const projectPath = locateLockfile('/my/project', 'project');
    expect(projectPath.replace(/\\/g, '/')).toBe('/my/project/.mcp.lock');
  });
});
