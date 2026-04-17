import { z } from 'zod';

export const LockEntrySourceSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  configPath: z.string(),
});

export const LockEntryResolvedSchema = z.object({
  registry: z.enum(['npm', 'pypi', 'docker', 'url', 'local', 'unknown']),
  name: z.string(),
  version: z.string(),
  tarball: z.string().nullable(),
  integrity: z.string().nullable(),
  shasum: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

export const LockEntryAttestationSchema = z.object({
  present: z.boolean(),
  predicateTypes: z.array(z.string()),
});

export const LockEntrySchema = z.object({
  source: LockEntrySourceSchema,
  resolved: LockEntryResolvedSchema,
  attestation: LockEntryAttestationSchema,
  lockedAt: z.string(),
});

export const LockFileSchema = z.object({
  lockfileVersion: z.literal(1),
  generatedBy: z.string(),
  generatedAt: z.string(),
  scope: z.enum(['project', 'global']),
  servers: z.record(z.string(), LockEntrySchema),
  checksum: z.string(),
});

export type LockEntrySource = z.infer<typeof LockEntrySourceSchema>;
export type LockEntryResolved = z.infer<typeof LockEntryResolvedSchema>;
export type LockEntryAttestation = z.infer<typeof LockEntryAttestationSchema>;
export type LockEntry = z.infer<typeof LockEntrySchema>;
export type LockFile = z.infer<typeof LockFileSchema>;

export type DiffStatus =
  | 'ok'
  | 'version-changed'
  | 'integrity-changed'
  | 'attestation-changed'
  | 'missing-upstream'
  | 'new-server'
  | 'unlockable';

export interface EntryChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface EntryDiff {
  serverName: string;
  status: DiffStatus;
  changes: EntryChange[];
}

export interface VerifyResult {
  ok: boolean;
  diffs: EntryDiff[];
  durationMs: number;
  lockfilePath: string;
}

export interface InitResult {
  lockfilePath: string;
  entries: Array<{ name: string; entry: LockEntry }>;
  skipped: Array<{ name: string; reason: string }>;
  pinnedConfigs: string[];
}

export interface RegistryScope {
  isLockable: boolean;
  reason?: string;
}
