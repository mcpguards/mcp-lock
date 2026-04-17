import { describe, it, expect } from 'vitest';
import { resolveNpmPackage } from '../../src/resolver/npm-resolver.js';

const base = { configPath: '/test/.mcp.json' };

describe('npm-resolver', () => {
  it('resolves npx -y @scope/package', () => {
    const result = resolveNpmPackage({
      name: 'fs', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'], env: {}, ...base,
    });
    expect(result?.packageName).toBe('@modelcontextprotocol/server-filesystem');
    expect(result?.isPinned).toBe(false);
    expect(result?.version).toBe('latest');
  });

  it('resolves pinned version @scope/package@version', () => {
    const result = resolveNpmPackage({
      name: 'fs', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@2025.11.18'], env: {}, ...base,
    });
    expect(result?.packageName).toBe('@modelcontextprotocol/server-filesystem');
    expect(result?.version).toBe('2025.11.18');
    expect(result?.isPinned).toBe(true);
  });

  it('resolves bunx command', () => {
    const result = resolveNpmPackage({
      name: 'test', command: 'bunx', args: ['my-mcp-server'], env: {}, ...base,
    });
    expect(result?.registry).toBe('npm');
    expect(result?.packageName).toBe('my-mcp-server');
  });

  it('returns null for non-npm command', () => {
    const result = resolveNpmPackage({
      name: 'py', command: 'uvx', args: ['mcp-server'], env: {}, ...base,
    });
    expect(result).toBeNull();
  });

  it('returns null for npx with no package arg', () => {
    const result = resolveNpmPackage({
      name: 'test', command: 'npx', args: ['-y'], env: {}, ...base,
    });
    expect(result).toBeNull();
  });
});
