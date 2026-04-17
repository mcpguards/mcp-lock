# mcp-lock

**`npm ci` for your MCP servers.**

> Every time your AI coding tool starts, `npx -y @scope/mcp-server` silently downloads the latest version of every MCP server. No version pin. No hash check. No record of what ran yesterday.
>
> `mcp-lock` fixes this. It records the exact version and tarball integrity hash of every MCP server on first run, and verifies nothing changed on every run after that.

---

## The problem

```jsonc
// Your .mcp.json — right now
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
      //        ^^^
      //        Downloads whatever is latest. Every. Single. Time.
    }
  }
}
```

The March 2026 axios supply chain attack compromised a minor version bump (`1.14.1`). Everyone using `^1.14.0` silently auto-upgraded. The malware ran before anyone noticed.

**MCP servers face identical risk.** They're npm packages. They run with your credentials. They access your filesystem and APIs. And no existing scanner tracks whether the package you're running today is the same one you reviewed last week.

---

## Install & quick start

```bash
# 1. Lock all your MCP servers (one time)
npx mcp-lock init

# 2. Commit the lockfile
git add .mcp.lock && git commit -m "chore: add mcp-lock lockfile"

# 3. Verify on every CI run (exits 1 if anything changed)
npx mcp-lock verify
```

That's it. If a package changes between runs, you'll know before your AI agent runs it.

---

## Commands

### `mcp-lock init`

Discovers all MCP configs on your machine, resolves each server to its npm package, records the exact version + tarball integrity hash.

```
$ mcp-lock init

Found 4 server(s) across 2 config(s)

  ✔ filesystem      2026.1.1            sha512-xK3z…  ✔ attestation
  ✔ github          2026.1.1            sha512-9mRq…  ✔ attestation
  ✔ memory          2025.11.18          sha512-pL2t…  ○ no attestation
  ~ python-server   pypi registry — not lockable

─────────────────────────────────────────────────────────────────
  3 locked  1 skipped

✔ Lockfile written to .mcp.lock
Tip: Run with --pin to add version pins to your MCP configs.
```

**Options:**
```
--config <path>   Scan a specific config file
--pin             Rewrite configs to add @version pins
--force           Overwrite existing lockfile
--global          Write to ~/.mcp.lock
```

---

### `mcp-lock verify`

Compares your installed packages against the lockfile. Exits `1` if anything changed.

```
$ mcp-lock verify

mcp-lock  .mcp.lock
────────────────────────────────────────────────────────────────
  ✔ filesystem
  ✔ github
  ⚠ memory  INTEGRITY-CHANGED
      integrity    sha512-pL2t…  →  sha512-XXXX…
      version      2025.11.18   →  2025.11.19
      ACTION REQUIRED: Run `mcp-lock update memory` after manual review.

────────────────────────────────────────────────────────────────
  2 clean  1 changed  0 skipped

✖ 1 server(s) changed since last lock.
  Run 'mcp-lock update <server>' to review and accept changes.
```

**Options:**
```
--sarif <path>    Write SARIF 2.1.0 report for GitHub Security tab
--json            Output as JSON
--global          Check against ~/.mcp.lock
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| `0`  | Clean — all servers match the lockfile |
| `1`  | Changed — one or more servers changed, or lockfile tampered |
| `2`  | Lockfile missing — run `mcp-lock init` |
| `3`  | Network / registry error |
| `4`  | Invalid arguments |

---

### `mcp-lock update <server>`

Shows exactly what changed, asks for confirmation, updates the lockfile.

```
$ mcp-lock update memory

  memory
  version      2025.11.18 → 2025.11.19
  integrity    sha512-pL2t… →
               sha512-XXXX…

Accept update for memory? [y/N] y
✔ Updated 1 server(s) in .mcp.lock
```

**Options:**
```
--all             Update all servers
--to <version>    Update to a specific version
--yes             Skip confirmation prompt (for CI)
--pin             Also update version pin in the MCP config
```

---

### `mcp-lock list`

Shows all locked servers.

```
$ mcp-lock list

mcp-lock list  scope: project
────────────────────────────────────────────────────────────────
  ✔ filesystem      @modelcontextprotocol/server-filesystem    2026.1.1
  ✔ github          @modelcontextprotocol/server-github        2026.1.1
  ○ memory          @modelcontextprotocol/server-memory        2025.11.18
────────────────────────────────────────────────────────────────
  3 servers  generated 4/16/2026
```

---

## GitHub Action

Add to any repo that has a `.mcp.json` config. Fails the PR if a server changed without an explicit `mcp-lock update`:

```yaml
# .github/workflows/mcp-lock.yml
name: MCP Lock
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write   # for SARIF upload
    steps:
      - uses: actions/checkout@v4

      - uses: mcpguards/mcp-lock@v1
        with:
          sarif-output: mcp-lock.sarif

      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: mcp-lock.sarif
```

Findings appear in the **Security → Code Scanning** tab:

```
mcp-lock: server 'memory' integrity changed
  The tarball integrity hash changed since last lock.
  Run: mcp-lock update memory
```

**Action inputs:**
| Input | Default | Description |
|-------|---------|-------------|
| `config-path` | _(auto-discover)_ | Path to MCP config |
| `fail-on-missing-lock` | `true` | Fail if no lockfile exists |
| `sarif-output` | _(none)_ | Path to write SARIF report |

---

## The lockfile

`.mcp.lock` is a JSON file you commit to your repository. It records:

```json
{
  "lockfileVersion": 1,
  "generatedBy": "mcp-lock@0.1.0",
  "generatedAt": "2026-04-16T12:00:00.000Z",
  "scope": "project",
  "servers": {
    "filesystem": {
      "source": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem"],
        "configPath": "/abs/path/.mcp.json"
      },
      "resolved": {
        "registry": "npm",
        "name": "@modelcontextprotocol/server-filesystem",
        "version": "2026.4.10",
        "tarball": "https://registry.npmjs.org/...tgz",
        "integrity": "sha512-AbC...==",
        "shasum": "a1b2c3...",
        "publishedAt": "2026-04-10T09:12:33.000Z"
      },
      "attestation": {
        "present": true,
        "predicateTypes": ["https://slsa.dev/provenance/v1"]
      },
      "lockedAt": "2026-04-16T12:00:00.000Z"
    }
  },
  "checksum": "sha256-9f86d081..."
}
```

The `checksum` field is a SHA-256 of the entire lockfile content (canonical JSON, sorted keys). If the file is manually edited without running `mcp-lock update`, `verify` will catch it.

---

## Supported MCP clients

Auto-discovered on your machine:

| Client | Config path |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code | `~/.claude/settings.json` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code | `~/Library/Application Support/Code/User/settings.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Amazon Q | `~/.aws/amazonq/mcp.json` |
| Project-level | `.mcp.json` in current directory |

---

## How it differs from other tools

| Tool | Checks npm packages | Integrity hash | Detects version changes | SBOM | Lockfile |
|------|:-:|:-:|:-:|:-:|:-:|
| Snyk Agent Scan | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cisco mcp-scanner | ❌ | ❌ | ❌ | ❌ | ❌ |
| MCPWatch | ❌ | ❌ | ❌ | ❌ | ❌ |
| **mcp-lock** | ✅ | ✅ | ✅ | ✅ | ✅ |

The others scan tool descriptions and configurations for prompt injection. `mcp-lock` treats MCP servers as **software supply chain artifacts** and applies package integrity verification — the same approach `npm ci` uses.

---

## Requirements

- Node.js >= 18.3.0
- Works with Claude Code, Cursor, VS Code Copilot, Windsurf, Amazon Q, and any tool using the MCP spec

---

## License

MIT © Vamshidhar Reddy Parupally
