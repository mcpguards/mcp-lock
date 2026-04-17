import { writeFile, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

export async function writeAtomic(filePath: string, data: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(tmpPath, data, 'utf-8');
    await rename(tmpPath, filePath);
  } catch (err) {
    await unlink(tmpPath).catch(() => undefined);
    throw err;
  }
}

export function joinPath(...parts: string[]): string {
  return join(...parts);
}
