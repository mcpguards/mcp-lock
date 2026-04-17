import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { writeAtomic } from '../util/fs-atomic.js';
import { LockFileSchema, type LockFile } from './schema.js';
import { verifyChecksum } from './checksum.js';
import {
  LockfileMissingError,
  LockfileTamperedError,
  LockfileVersionError,
} from '../util/errors.js';

export const LOCKFILE_NAME = '.mcp.lock';

export function locateLockfile(cwd: string, scope: 'project' | 'global'): string {
  if (scope === 'global') return join(homedir(), LOCKFILE_NAME);
  return join(cwd, LOCKFILE_NAME);
}

export async function lockfileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readLockfile(path: string): Promise<LockFile> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    throw new LockfileMissingError(path);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LockfileTamperedError(path);
  }

  const result = LockFileSchema.safeParse(parsed);
  if (!result.success) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj['lockfileVersion'] === 'number' && obj['lockfileVersion'] !== 1) {
      throw new LockfileVersionError(obj['lockfileVersion'] as number);
    }
    throw new LockfileTamperedError(path);
  }

  if (!verifyChecksum(result.data)) {
    throw new LockfileTamperedError(path);
  }

  return result.data;
}

export async function writeLockfile(path: string, lock: LockFile): Promise<void> {
  await writeAtomic(path, JSON.stringify(lock, null, 2) + '\n');
}
