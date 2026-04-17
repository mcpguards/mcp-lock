import { describe, it, expect } from 'vitest';
import { diffEntry } from '../../src/lockfile/diff.js';
import type { LockEntry } from '../../src/lockfile/schema.js';

const base: LockEntry = {
  source: { command: 'npx', args: ['-y', 'test-pkg'], configPath: '/test/.mcp.json' },
  resolved: {
    registry: 'npm',
    name: 'test-pkg',
    version: '1.0.0',
    tarball: 'https://example.com/test.tgz',
    integrity: 'sha512-aaa==',
    shasum: 'abc',
    publishedAt: null,
  },
  attestation: { present: true, predicateTypes: ['https://slsa.dev/provenance/v1'] },
  lockedAt: '2026-04-16T12:00:00.000Z',
};

describe('diffEntry', () => {
  it('returns ok when nothing changed', () => {
    const result = diffEntry('test', base, { ...base });
    expect(result.status).toBe('ok');
    expect(result.changes).toHaveLength(0);
  });

  it('detects version change', () => {
    const current = { ...base, resolved: { ...base.resolved, version: '1.0.1' } };
    const result = diffEntry('test', base, current);
    expect(result.status).toBe('version-changed');
    expect(result.changes).toContainEqual(expect.objectContaining({ field: 'version' }));
  });

  it('detects integrity change (highest severity)', () => {
    const current = {
      ...base,
      resolved: { ...base.resolved, version: '1.0.1', integrity: 'sha512-bbb==' },
    };
    const result = diffEntry('test', base, current);
    expect(result.status).toBe('integrity-changed');
  });

  it('detects attestation change', () => {
    const current = { ...base, attestation: { present: false, predicateTypes: [] } };
    const result = diffEntry('test', base, current);
    expect(result.status).toBe('attestation-changed');
  });

  it('returns missing-upstream when current is null', () => {
    const result = diffEntry('test', base, null);
    expect(result.status).toBe('missing-upstream');
  });

  it('returns unlockable for explicit status', () => {
    const result = diffEntry('test', base, base, 'unlockable');
    expect(result.status).toBe('unlockable');
  });
});
