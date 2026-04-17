import { resolve } from 'node:path';
import { readLockfile, locateLockfile, lockfileExists } from '../lockfile/io.js';
import { renderLockfileTable } from '../output/table.js';
import { info, printJson, isJsonMode } from '../output/logger.js';
import { LockfileMissingError } from '../util/errors.js';

interface ListOptions {
  global: boolean;
  project: boolean;
  cwd: string;
}

export async function runList(opts: ListOptions): Promise<void> {
  const cwd = resolve(opts.cwd);

  const projectLock = locateLockfile(cwd, 'project');
  const globalLock  = locateLockfile(cwd, 'global');
  let lockfilePath  = projectLock;

  if (opts.global) lockfilePath = globalLock;
  else if (opts.project) lockfilePath = projectLock;
  else if (!(await lockfileExists(projectLock)) && await lockfileExists(globalLock)) {
    lockfilePath = globalLock;
  }

  const lock = await readLockfile(lockfilePath);

  if (isJsonMode()) {
    printJson(lock);
    return;
  }

  info(renderLockfileTable(lock));
}
