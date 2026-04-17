import { createHash } from 'node:crypto';
import type { LockFile } from './schema.js';

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const sorted = Object.keys(obj)
    .sort()
    .map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]))
    .join(',');
  return '{' + sorted + '}';
}

export function computeChecksum(lockWithoutChecksum: Omit<LockFile, 'checksum'>): string {
  const canonical = canonicalize(lockWithoutChecksum);
  const hash = createHash('sha256').update(canonical, 'utf-8').digest('hex');
  return `sha256-${hash}`;
}

export function verifyChecksum(lock: LockFile): boolean {
  const { checksum, ...rest } = lock;
  const expected = computeChecksum(rest);
  return checksum === expected;
}
