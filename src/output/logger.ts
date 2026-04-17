export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let jsonMode = false;
let debugMode = false;

export function setJsonMode(enabled: boolean): void { jsonMode = enabled; }
export function setDebugMode(enabled: boolean): void { debugMode = enabled; }
export function isJsonMode(): boolean { return jsonMode; }

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[37m',
};

function noColor(): boolean {
  return !process.stdout.isTTY || !!process.env['NO_COLOR'] || !!process.env['CI'];
}

export function color(c: keyof typeof C, text: string): string {
  if (noColor()) return text;
  return C[c] + text + C.reset;
}

export function bold(text: string): string { return color('bold', text); }
export function dim(text: string): string  { return color('dim', text); }

export function info(msg: string): void {
  if (jsonMode) return;
  process.stdout.write(msg + '\n');
}

export function warn(msg: string): void {
  if (jsonMode) return;
  process.stderr.write(color('yellow', '⚠ ') + msg + '\n');
}

export function error(msg: string): void {
  if (jsonMode) return;
  process.stderr.write(color('red', '✖ ') + msg + '\n');
}

export function debug(msg: string): void {
  if (!debugMode || jsonMode) return;
  process.stderr.write(color('gray', '» ') + dim(msg) + '\n');
}

export function success(msg: string): void {
  if (jsonMode) return;
  process.stdout.write(color('green', '✔ ') + msg + '\n');
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}
