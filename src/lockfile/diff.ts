import type { LockEntry, EntryDiff, EntryChange, DiffStatus } from './schema.js';

export function diffEntry(
  serverName: string,
  locked: LockEntry,
  current: LockEntry | null,
  status?: DiffStatus,
): EntryDiff {
  if (status === 'missing-upstream' || current === null) {
    return { serverName, status: 'missing-upstream', changes: [] };
  }

  if (status === 'unlockable') {
    return { serverName, status: 'unlockable', changes: [] };
  }

  const changes: EntryChange[] = [];

  if (locked.resolved.version !== current.resolved.version) {
    changes.push({
      field: 'version',
      before: locked.resolved.version,
      after: current.resolved.version,
    });
  }

  if (
    locked.resolved.integrity !== null &&
    current.resolved.integrity !== null &&
    locked.resolved.integrity !== current.resolved.integrity
  ) {
    changes.push({
      field: 'integrity',
      before: locked.resolved.integrity,
      after: current.resolved.integrity,
    });
  }

  if (locked.attestation.present !== current.attestation.present) {
    changes.push({
      field: 'attestation.present',
      before: locked.attestation.present,
      after: current.attestation.present,
    });
  }

  if (changes.length === 0) {
    return { serverName, status: 'ok', changes: [] };
  }

  const hasIntegrity = changes.some((c) => c.field === 'integrity');
  const hasVersion = changes.some((c) => c.field === 'version');

  let diffStatus: DiffStatus = 'version-changed';
  if (hasIntegrity) diffStatus = 'integrity-changed';
  if (hasIntegrity && hasVersion) diffStatus = 'integrity-changed';

  const attestationChange = changes.find((c) => c.field === 'attestation.present');
  if (attestationChange && !hasIntegrity && !hasVersion) {
    diffStatus = 'attestation-changed';
  }

  return { serverName, status: diffStatus, changes };
}
