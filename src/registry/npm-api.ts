import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { RegistryError, NetworkError } from '../util/errors.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const CACHE_DIR = join(
  process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'),
  'mcp-lock',
);
const METADATA_TTL = 3_600_000;   // 1 hour
const AUDIT_TTL    = 900_000;     // 15 minutes
const REQUEST_TIMEOUT = 10_000;
const MAX_RETRIES = 2;

// ---- Zod schemas ----

const NpmDistSchema = z.object({
  tarball: z.string(),
  shasum: z.string(),
  integrity: z.string().optional(),
});

export const NpmVersionMetaSchema = z.object({
  name: z.string(),
  version: z.string(),
  scripts: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  dist: NpmDistSchema,
  _npmUser: z.object({ name: z.string(), email: z.string() }).optional(),
});

export const NpmPackumentSchema = z.object({
  name: z.string(),
  'dist-tags': z.record(z.string(), z.string()),
  versions: z.record(z.string(), NpmVersionMetaSchema),
  time: z.record(z.string(), z.string()).optional(),
  maintainers: z.array(z.object({ name: z.string(), email: z.string() })).optional(),
});

export const NpmAttestationSchema = z.object({
  attestations: z.array(
    z.object({
      predicateType: z.string(),
      bundle: z.unknown(),
    }),
  ),
});

export type NpmVersionMeta = z.infer<typeof NpmVersionMetaSchema>;
export type NpmPackument = z.infer<typeof NpmPackumentSchema>;
export type NpmAttestationResponse = z.infer<typeof NpmAttestationSchema>;

// ---- Cache ----

async function getCachePath(key: string): Promise<string> {
  const hash = createHash('sha256').update(key).digest('hex');
  return join(CACHE_DIR, `${hash}.json`);
}

async function readCache<T>(key: string, ttl: number): Promise<T | null> {
  try {
    const path = await getCachePath(key);
    const raw = await readFile(path, 'utf-8');
    const cached = JSON.parse(raw) as { timestamp: number; data: T };
    if (Date.now() - cached.timestamp < ttl) return cached.data;
  } catch {
    /* cache miss */
  }
  return null;
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const path = await getCachePath(key);
    await writeFile(path, JSON.stringify({ timestamp: Date.now(), data }), 'utf-8');
  } catch {
    /* non-fatal */
  }
}

// ---- Fetch with retry ----

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
  }
  throw new NetworkError(url, lastError?.message ?? 'unknown');
}

async function cachedFetch<T>(
  url: string,
  schema: z.ZodType<T>,
  ttl: number,
): Promise<T> {
  const cached = await readCache<T>(url, ttl);
  if (cached !== null) return cached;

  const res = await fetchWithRetry(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'mcp-lock/0.1.0' },
  });

  if (!res.ok) {
    throw new RegistryError('unknown', res.status, `HTTP ${res.status} for ${url}`);
  }

  const raw = await res.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new RegistryError('unknown', 0, `Unexpected registry response shape for ${url}`);
  }

  await writeCache(url, parsed.data);
  return parsed.data;
}

// ---- Public API ----

export async function fetchPackageMetadata(packageName: string): Promise<NpmPackument> {
  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`;
  try {
    return await cachedFetch(url, NpmPackumentSchema, METADATA_TTL);
  } catch (err) {
    if (err instanceof RegistryError) throw err;
    throw new RegistryError(packageName, 0, String(err));
  }
}

export async function fetchVersionMetadata(
  packageName: string,
  version: string,
): Promise<NpmVersionMeta> {
  const resolvedVersion = version === 'latest' || version === 'installed' ? 'latest' : version;
  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/${encodeURIComponent(resolvedVersion)}`;
  try {
    return await cachedFetch(url, NpmVersionMetaSchema, METADATA_TTL);
  } catch (err) {
    if (err instanceof RegistryError) throw err;
    throw new RegistryError(packageName, 0, String(err));
  }
}

export async function fetchAttestations(
  packageName: string,
  version: string,
): Promise<NpmAttestationResponse | null> {
  const url = `${NPM_REGISTRY}/-/npm/v1/attestations/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  try {
    return await cachedFetch(url, NpmAttestationSchema, METADATA_TTL);
  } catch {
    return null;
  }
}

export async function packageExists(packageName: string, version: string): Promise<boolean> {
  try {
    await fetchVersionMetadata(packageName, version);
    return true;
  } catch (err) {
    if (err instanceof RegistryError && err.statusCode === 404) return false;
    throw err;
  }
}
