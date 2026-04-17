import { readFile } from 'node:fs/promises';
import { writeAtomic } from '../util/fs-atomic.js';

function injectVersionPin(args: string[], packageName: string, version: string): string[] {
  return args.map((arg) => {
    if (arg === packageName || arg.startsWith(`${packageName}@`)) {
      return `${packageName}@${version}`;
    }
    return arg;
  });
}

function patchJsonArgs(
  raw: string,
  serverName: string,
  packageName: string,
  version: string,
): string {
  // Find the server entry and patch its args array
  // Use a regex approach that preserves formatting
  const serverPattern = new RegExp(
    `("${escapeRegex(serverName)}"\\s*:\\s*\\{[^}]*?"args"\\s*:\\s*\\[)([^\\]]*?)(\\])`,
    's',
  );

  return raw.replace(serverPattern, (_match, before, argsContent, after) => {
    const patched = argsContent.replace(
      new RegExp(`"${escapeRegex(packageName)}(?:@[^"]*)?"`),
      `"${packageName}@${version}"`,
    );
    return before + patched + after;
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function rewriteConfigPin(
  filePath: string,
  serverName: string,
  packageName: string,
  version: string,
): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return false;
  }

  const patched = patchJsonArgs(raw, serverName, packageName, version);
  if (patched === raw) return false; // nothing changed

  await writeAtomic(filePath, patched);
  return true;
}

export { injectVersionPin };
