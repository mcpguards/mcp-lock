import { parseArgs } from 'node:util';
import { runInit } from './commands/init.js';
import { runVerify } from './commands/verify.js';
import { runUpdate } from './commands/update.js';
import { runList } from './commands/list.js';
import { setJsonMode, setDebugMode, error, info, bold, color } from './output/logger.js';
import { McpLockError } from './util/errors.js';

const VERSION = '0.1.0';

const HELP = `
${bold('mcp-lock')} v${VERSION}
${color('gray', 'npm ci for your MCP servers — integrity verification for AI coding tool packages')}

${bold('USAGE')}
  mcp-lock <command> [options]

${bold('COMMANDS')}
  init      Record integrity hashes for all MCP servers
  verify    Check servers against the lockfile (exit 1 if changed)
  update    Update one or more servers in the lockfile
  list      Show all locked servers

${bold('GLOBAL OPTIONS')}
  --config <path>   Path to MCP config file (can be repeated)
  --cwd <path>      Working directory (default: process.cwd())
  --global          Use global lockfile (~/.mcp.lock)
  --project         Use project lockfile (./.mcp.lock)
  --json            Output as JSON
  --debug           Enable debug logging
  --version, -v     Print version
  --help, -h        Print this help

${bold('EXAMPLES')}
  mcp-lock init                                  # auto-discover configs
  mcp-lock init --config ~/.cursor/mcp.json      # specific config
  mcp-lock init --pin                            # also pin versions in config
  mcp-lock verify                                # CI check, exits 1 if changed
  mcp-lock verify --sarif results.sarif          # emit SARIF for GitHub Security tab
  mcp-lock update filesystem                     # update one server
  mcp-lock update --all --yes                    # update all non-interactively
  mcp-lock list                                  # show locked servers

${bold('EXIT CODES')}
  0  Clean — all servers match the lockfile
  1  Changed — one or more servers changed, or lockfile tampered
  2  Lockfile missing — run mcp-lock init
  3  Network / registry error
  4  Invalid arguments or config
`;

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs[0] === '--help' || rawArgs[0] === '-h') {
    info(HELP);
    process.exit(0);
  }

  if (rawArgs[0] === '--version' || rawArgs[0] === '-v') {
    info(`mcp-lock v${VERSION}`);
    process.exit(0);
  }

  const command = rawArgs[0];
  const args = rawArgs.slice(1);

  if (!['init', 'verify', 'update', 'list'].includes(command ?? '')) {
    error(`Unknown command: ${command}`);
    info(HELP);
    process.exit(4);
  }

  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        config:   { type: 'string',  multiple: true, short: 'c' },
        cwd:      { type: 'string',  default: process.cwd() },
        global:   { type: 'boolean', default: false },
        project:  { type: 'boolean', default: false },
        pin:      { type: 'boolean', default: false },
        force:    { type: 'boolean', default: false, short: 'f' },
        yes:      { type: 'boolean', default: false, short: 'y' },
        all:      { type: 'boolean', default: false },
        to:       { type: 'string' },
        sarif:    { type: 'string' },
        json:     { type: 'boolean', default: false },
        debug:    { type: 'boolean', default: false },
        help:     { type: 'boolean', default: false, short: 'h' },
        offline:  { type: 'boolean', default: false },
      },
      allowPositionals: true,
      strict: false,
    });

    if (values.json) setJsonMode(true);
    if (values.debug) setDebugMode(true);

    if (values.help) {
      info(HELP);
      process.exit(0);
    }

    const sharedOpts = {
      configs:  (values.config as string[] | undefined) ?? [],
      cwd:      (values.cwd as string | undefined) ?? process.cwd(),
      global:   (values.global as boolean | undefined) ?? false,
      project:  (values.project as boolean | undefined) ?? false,
    };

    switch (command) {
      case 'init':
        await runInit({
          ...sharedOpts,
          pin:    (values.pin as boolean | undefined) ?? false,
          force:  (values.force as boolean | undefined) ?? false,
        });
        break;

      case 'verify':
        await runVerify({
          ...sharedOpts,
          sarif:   values.sarif as string | undefined,
          offline: (values.offline as boolean | undefined) ?? false,
        });
        break;

      case 'update': {
        const serverArgs = positionals as string[];
        await runUpdate({
          ...sharedOpts,
          servers: serverArgs,
          all:  (values.all as boolean | undefined) ?? false,
          to:   values.to as string | undefined,
          yes:  (values.yes as boolean | undefined) ?? false,
          pin:  (values.pin as boolean | undefined) ?? false,
        });
        break;
      }

      case 'list':
        await runList(sharedOpts);
        break;
    }
  } catch (err) {
    if (err instanceof McpLockError) {
      error(err.message);
      if (err.hint) info(`  ${err.hint}`);
      process.exit(err.exitCode);
    }
    if (err instanceof Error) {
      error(`Unexpected error: ${err.message}`);
      if (process.env['DEBUG']) console.error(err.stack);
    } else {
      error(`Unexpected error: ${String(err)}`);
    }
    process.exit(1);
  }
}

main();
