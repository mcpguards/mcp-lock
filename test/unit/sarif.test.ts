import { describe, it, expect } from 'vitest';
import { generateSarif } from '../../src/output/sarif.js';
import type { EntryDiff } from '../../src/lockfile/schema.js';

describe('sarif', () => {
  it('generates a valid SARIF 2.1.0 structure', () => {
    const diffs: EntryDiff[] = [
      {
        serverName: 'filesystem',
        status: 'integrity-changed',
        changes: [{ field: 'integrity', before: 'sha512-aaa==', after: 'sha512-bbb==' }],
      },
    ];

    const sarif = generateSarif(diffs, '/test/.mcp.lock');

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]!.tool.driver.name).toBe('mcp-lock');
    expect(sarif.runs[0]!.results).toHaveLength(1);
  });

  it('produces no results for clean scan', () => {
    const diffs: EntryDiff[] = [
      { serverName: 'filesystem', status: 'ok', changes: [] },
      { serverName: 'python', status: 'unlockable', changes: [] },
    ];
    const sarif = generateSarif(diffs, '/test/.mcp.lock');
    expect(sarif.runs[0]!.results).toHaveLength(0);
  });

  it('deduplicates rules for repeated finding types', () => {
    const diffs: EntryDiff[] = [
      { serverName: 'server-a', status: 'version-changed', changes: [] },
      { serverName: 'server-b', status: 'version-changed', changes: [] },
    ];
    const sarif = generateSarif(diffs, '/test/.mcp.lock');
    expect(sarif.runs[0]!.tool.driver.rules).toHaveLength(1);
    expect(sarif.runs[0]!.results).toHaveLength(2);
  });
});
