import { color, bold, dim } from './logger.js';
import type { EntryDiff } from '../lockfile/schema.js';
import type { LockFile, LockEntry } from '../lockfile/schema.js';

const STATUS_ICON: Record<string, string> = {
  ok:                   '✔',
  'version-changed':    '↑',
  'integrity-changed':  '⚠',
  'attestation-changed':'◎',
  'missing-upstream':   '✖',
  'new-server':         '+',
  unlockable:           '~',
};

const STATUS_COLOR: Record<string, Parameters<typeof color>[0]> = {
  ok:                   'green',
  'version-changed':    'yellow',
  'integrity-changed':  'red',
  'attestation-changed':'yellow',
  'missing-upstream':   'red',
  'new-server':         'cyan',
  unlockable:           'gray',
};

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function padEnd(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export function renderVerifyTable(diffs: EntryDiff[], lockfilePath: string): string {
  const lines: string[] = [];
  const sep = '─'.repeat(64);

  lines.push('');
  lines.push(bold('mcp-lock') + dim('  ' + lockfilePath));
  lines.push(dim(sep));

  for (const diff of diffs) {
    const icon = STATUS_ICON[diff.status] ?? '?';
    const col  = STATUS_COLOR[diff.status] ?? 'white';
    const statusStr = color(col, `${icon} ${diff.serverName}`);

    if (diff.status === 'ok') {
      lines.push(`  ${statusStr}`);
      continue;
    }

    if (diff.status === 'unlockable') {
      lines.push(`  ${statusStr}  ${dim('(non-npm, skipped)')}`);
      continue;
    }

    lines.push(`  ${statusStr}  ${color(col, diff.status.toUpperCase())}`);
    for (const change of diff.changes) {
      lines.push(
        `      ${dim(padEnd(change.field, 20))}  ` +
        `${color('red', truncate(String(change.before), 40))}  →  ` +
        `${color('green', truncate(String(change.after), 40))}`,
      );
    }
    if (diff.status === 'integrity-changed') {
      lines.push('      ' + color('red', bold('ACTION REQUIRED:') + ' Run `mcp-lock update ' + diff.serverName + '` after manual review.'));
    }
    lines.push('');
  }

  const ok    = diffs.filter((d) => d.status === 'ok').length;
  const changed = diffs.filter((d) => d.status !== 'ok' && d.status !== 'unlockable').length;
  const skipped = diffs.filter((d) => d.status === 'unlockable').length;

  lines.push(dim(sep));
  lines.push(
    `  ${color('green', `${ok} clean`)}  ` +
    (changed > 0 ? color('red', `${changed} changed`) : dim('0 changed')) +
    `  ${dim(`${skipped} skipped`)}`,
  );
  lines.push('');

  return lines.join('\n');
}

export function renderInitTable(
  entries: Array<{ name: string; entry: LockEntry }>,
  skipped: Array<{ name: string; reason: string }>,
): string {
  const lines: string[] = [];
  const sep = '─'.repeat(64);

  lines.push('');
  lines.push(bold('mcp-lock init'));
  lines.push(dim(sep));

  for (const { name, entry } of entries) {
    const integrity = entry.resolved.integrity ?? 'n/a';
    const intShort  = integrity.length > 20 ? integrity.slice(0, 16) + '…' : integrity;
    const attest    = entry.attestation.present
      ? color('green', '✔ attestation')
      : color('gray', '- no attestation');

    lines.push(
      `  ${color('green', '✔')} ${bold(padEnd(name, 24))}  ` +
      `${color('cyan', padEnd(entry.resolved.version, 20))}  ` +
      `${dim(intShort)}  ${attest}`,
    );
  }

  if (skipped.length > 0) {
    lines.push('');
    for (const s of skipped) {
      lines.push(`  ${color('gray', '~')} ${dim(padEnd(s.name, 24))}  ${dim(s.reason)}`);
    }
  }

  lines.push(dim(sep));
  lines.push(`  ${color('green', `${entries.length} locked`)}  ${dim(`${skipped.length} skipped`)}`);
  lines.push('');

  return lines.join('\n');
}

export function renderLockfileTable(lock: LockFile): string {
  const lines: string[] = [];
  const sep = '─'.repeat(64);

  lines.push('');
  lines.push(bold('mcp-lock list') + dim('  scope: ' + lock.scope));
  lines.push(dim(sep));

  for (const [name, entry] of Object.entries(lock.servers)) {
    const attest = entry.attestation.present
      ? color('green', '✔')
      : color('gray', '○');
    lines.push(
      `  ${attest} ${bold(padEnd(name, 24))}  ` +
      `${color('cyan', padEnd(entry.resolved.name, 40))}  ` +
      `${color('yellow', entry.resolved.version)}`,
    );
  }

  lines.push(dim(sep));
  lines.push(`  ${Object.keys(lock.servers).length} servers  ` +
    dim(`generated ${new Date(lock.generatedAt).toLocaleDateString()}`));
  lines.push('');

  return lines.join('\n');
}

export function renderDiffBlock(
  serverName: string,
  oldEntry: LockEntry,
  newEntry: LockEntry,
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(bold(`  ${serverName}`));

  if (oldEntry.resolved.version !== newEntry.resolved.version) {
    lines.push(
      `  version      ${color('red', oldEntry.resolved.version)} → ${color('green', newEntry.resolved.version)}`,
    );
  }
  if (oldEntry.resolved.integrity !== newEntry.resolved.integrity) {
    lines.push(
      `  integrity    ${color('red', truncate(oldEntry.resolved.integrity ?? 'null', 32))} →`,
      `               ${color('green', truncate(newEntry.resolved.integrity ?? 'null', 32))}`,
    );
  }
  if (oldEntry.attestation.present !== newEntry.attestation.present) {
    lines.push(
      `  attestation  ${color('red', String(oldEntry.attestation.present))} → ${color('green', String(newEntry.attestation.present))}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
