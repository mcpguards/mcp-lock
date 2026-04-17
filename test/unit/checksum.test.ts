import { describe, it, expect } from 'vitest';
import { computeChecksum, verifyChecksum } from '../../src/lockfile/checksum.js';
import type { LockFile } from '../../src/lockfile/schema.js';

const baseLock: Omit<LockFile, 'checksum'> = {
  lockfileVersion: 1,
  generatedBy: 'mcp-lock@0.1.0',
  generatedAt: '2026-04-16T12:00:00.000Z',
  scope: 'project',
  servers: {
    test: {
      source: { command: 'npx', args: ['-y', 'test-pkg'], configPath: '/test/.mcp.json' },
      resolved: {
        registry: 'npm',
        name: 'test-pkg',
        version: '1.0.0',
        tarball: 'https://example.com/test.tgz',
        integrity: 'sha512-abc==',
        shasum: 'abc123',
        publishedAt: null,
      },
      attestation: { present: false, predicateTypes: [] },
      lockedAt: '2026-04-16T12:00:00.000Z',
    },
  },
};

describe('checksum', () => {
  it('computes a deterministic checksum', () => {
    const c1 = computeChecksum(baseLock);
    const c2 = computeChecksum(baseLock);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it('is stable regardless of key insertion order', () => {
    const reordered: Omit<LockFile, 'checksum'> = {
      servers: baseLock.servers,
      scope: baseLock.scope,
      generatedAt: baseLock.generatedAt,
      generatedBy: baseLock.generatedBy,
      lockfileVersion: baseLock.lockfileVersion,
    };
    expect(computeChecksum(baseLock)).toBe(computeChecksum(reordered));
  });

  it('verifyChecksum returns true for a valid lockfile', () => {
    const checksum = computeChecksum(baseLock);
    const lock: LockFile = { ...baseLock, checksum };
    expect(verifyChecksum(lock)).toBe(true);
  });

  it('verifyChecksum returns false after tampering', () => {
    const checksum = computeChecksum(baseLock);
    const lock: LockFile = { ...baseLock, checksum };
    const tampered = {
      ...lock,
      servers: {
        ...lock.servers,
        test: {
          ...lock.servers['test']!,
          resolved: {
            ...lock.servers['test']!.resolved,
            version: '9.9.9',
          },
        },
      },
    };
    expect(verifyChecksum(tampered)).toBe(false);
  });
});
