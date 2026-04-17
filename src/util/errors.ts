export class McpLockError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'McpLockError';
  }
}

export class LockfileMissingError extends McpLockError {
  constructor(path: string) {
    super(
      `No lockfile found at ${path}`,
      2,
      "Run 'mcp-lock init' to create one.",
    );
    this.name = 'LockfileMissingError';
  }
}

export class LockfileTamperedError extends McpLockError {
  constructor(path: string) {
    super(
      `Lockfile checksum mismatch — ${path} has been manually modified`,
      1,
      "Run 'mcp-lock init --force' to regenerate, or restore from git.",
    );
    this.name = 'LockfileTamperedError';
  }
}

export class LockfileVersionError extends McpLockError {
  constructor(found: number) {
    super(
      `Unsupported lockfile version: ${found}. This lockfile was created by a newer version of mcp-lock.`,
      1,
      'Upgrade mcp-lock: npm install -g mcp-lock@latest',
    );
    this.name = 'LockfileVersionError';
  }
}

export class RegistryError extends McpLockError {
  constructor(
    public readonly packageName: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(`Registry error for ${packageName}: ${message}`, 3);
    this.name = 'RegistryError';
  }
}

export class NetworkError extends McpLockError {
  constructor(url: string, cause: string) {
    super(`Network request failed for ${url}: ${cause}`, 3, 'Check your internet connection or use --offline.');
    this.name = 'NetworkError';
  }
}

export class ConfigNotFoundError extends McpLockError {
  constructor(path: string) {
    super(`Config file not found: ${path}`, 4);
    this.name = 'ConfigNotFoundError';
  }
}

export class NoServersFoundError extends McpLockError {
  constructor() {
    super(
      'No MCP servers found in any discovered config.',
      4,
      "Use --config <path> to specify a config file, or check that your MCP config contains an 'mcpServers' key.",
    );
    this.name = 'NoServersFoundError';
  }
}

export class ServerNotInLockfileError extends McpLockError {
  constructor(name: string) {
    super(
      `Server '${name}' not found in lockfile.`,
      4,
      "Run 'mcp-lock list' to see all locked servers.",
    );
    this.name = 'ServerNotInLockfileError';
  }
}

export class NonInteractiveError extends McpLockError {
  constructor() {
    super(
      'Running in non-interactive mode. Use --yes to confirm without a prompt.',
      4,
    );
    this.name = 'NonInteractiveError';
  }
}
