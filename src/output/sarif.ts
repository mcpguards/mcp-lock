import type { EntryDiff } from '../lockfile/schema.js';

const RULE_DEFINITIONS: Record<string, { name: string; description: string; level: string }> = {
  'integrity-changed': {
    name: 'IntegrityChanged',
    description: 'The tarball integrity hash of an MCP server package changed since it was locked. This indicates the package was updated, possibly maliciously.',
    level: 'error',
  },
  'version-changed': {
    name: 'VersionChanged',
    description: 'The version of an MCP server package changed since it was locked. Run mcp-lock update to review and accept this change.',
    level: 'warning',
  },
  'attestation-changed': {
    name: 'AttestationChanged',
    description: 'The SLSA provenance attestation status changed for this package. A previously attested package now lacks provenance — a known signal of supply chain compromise.',
    level: 'warning',
  },
  'missing-upstream': {
    name: 'MissingUpstream',
    description: 'The locked version of this package no longer exists on the npm registry. It may have been unpublished.',
    level: 'error',
  },
};

export interface SarifReport {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: { name: string; version: string; informationUri: string; rules: unknown[] } };
  results: unknown[];
}

export function generateSarif(
  diffs: EntryDiff[],
  lockfilePath: string,
  toolVersion = '0.1.0',
): SarifReport {
  const findings = diffs.filter((d) => d.status !== 'ok' && d.status !== 'unlockable');

  const seenRules = new Set<string>();
  const rules = findings
    .map((d) => d.status)
    .filter((s): s is string => !!RULE_DEFINITIONS[s])
    .filter((s) => { if (seenRules.has(s)) return false; seenRules.add(s); return true; })
    .map((s) => {
      const def = RULE_DEFINITIONS[s]!;
      return {
        id: s,
        name: def.name,
        shortDescription: { text: def.description },
        fullDescription: { text: def.description },
        help: { text: `Run: mcp-lock update <server-name>` },
        properties: { tags: ['supply-chain', 'mcp', 'integrity'] },
      };
    });

  const results = findings.map((diff) => {
    const def = RULE_DEFINITIONS[diff.status];
    const changes = diff.changes
      .map((c) => `${c.field}: ${String(c.before)} → ${String(c.after)}`)
      .join('\n');

    return {
      ruleId: diff.status,
      level: def?.level ?? 'warning',
      message: {
        text: `MCP server '${diff.serverName}' ${diff.status.replace(/-/g, ' ')}.\n${changes}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: lockfilePath, uriBaseId: '%SRCROOT%' },
          },
          logicalLocations: [{ name: diff.serverName, kind: 'module' }],
        },
      ],
      properties: {
        serverName: diff.serverName,
        changes: diff.changes,
      },
    };
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'mcp-lock',
            version: toolVersion,
            informationUri: 'https://github.com/mcpguards/mcp-lock',
            rules,
          },
        },
        results,
      },
    ],
  };
}
