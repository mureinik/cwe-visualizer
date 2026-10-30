// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { advisoryIds, advisoryPackages, isGhsaId } from '../../scripts/advisory-packages.ts';

const fixture = new URL('../fixtures/npm-audit.json', import.meta.url);
const report: unknown = JSON.parse(readFileSync(fixture, 'utf8'));

describe('isGhsaId', () => {
  it("accepts GitHub's form", () => {
    expect(isGhsaId('GHSA-gg6h-894w-4m9c')).toBe(true);
    expect(isGhsaId('GHSA-mrhx-c7xc-m3w5')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const value of ['ghsa-gg6h-894w-4m9c', 'GHSA-gg6h-894w', 'GHSA-gg6h-894w-4m9c-x', 'GHSA-gg6h-894w-4m9c\nx', 'CVE-2026-1234', '']) {
      expect(isGhsaId(value)).toBe(false);
    }
  });
});

describe('advisoryPackages', () => {
  it('names the vulnerable package, not the packages it propagates to', () => {
    expect(advisoryPackages(report, 'GHSA-gg6h-894w-4m9c')).toEqual(['re2js']);
  });

  it('matches the GHSA ID case-insensitively', () => {
    expect(advisoryPackages(report, 'GHSA-GG6H-894W-4M9C')).toEqual(['re2js']);
  });

  it('returns nothing for an advisory the report lacks', () => {
    expect(advisoryPackages(report, 'GHSA-mrhx-c7xc-m3w5')).toEqual([]);
  });

  it('returns nothing for a clean report', () => {
    expect(advisoryPackages({ auditReportVersion: 2, vulnerabilities: {} }, 'GHSA-gg6h-894w-4m9c')).toEqual([]);
  });

  it('deduplicates and sorts', () => {
    const url = 'https://github.com/advisories/GHSA-gg6h-894w-4m9c';
    const clean = {
      auditReportVersion: 2,
      vulnerabilities: {
        x: { via: [{ name: 'b', url }, { name: 'a', url }] },
        y: { via: ['x', { name: 'a', url }] },
      },
    };
    expect(advisoryPackages(clean, 'GHSA-gg6h-894w-4m9c')).toEqual(['a', 'b']);
  });

  it('refuses an npm error report', () => {
    expect(() => advisoryPackages({ error: { code: 'ENOLOCK', summary: 'x' } }, 'GHSA-gg6h-894w-4m9c')).toThrow();
  });

  it('refuses something that is not an audit report', () => {
    for (const value of [null, [], {}]) {
      expect(() => advisoryPackages(value, 'GHSA-gg6h-894w-4m9c')).toThrow();
    }
  });
});

describe('advisoryIds', () => {
  it("lists the report's advisories", () => {
    expect(advisoryIds(report)).toEqual(['GHSA-gg6h-894w-4m9c']);
  });

  it('returns nothing for a clean report', () => {
    expect(advisoryIds({ auditReportVersion: 2, vulnerabilities: {} })).toEqual([]);
  });

  it('deduplicates and sorts across vulnerabilities, in GitHub\'s form', () => {
    const advisory = (id: string) => ({ name: 'p', url: `https://github.com/advisories/${id}` });
    const many = {
      auditReportVersion: 2,
      vulnerabilities: {
        x: { via: [advisory('GHSA-mrhx-c7xc-m3w5'), advisory('GHSA-gg6h-894w-4m9c')] },
        y: { via: ['x', advisory('ghsa-GG6H-894W-4M9C'), { name: 'q', url: 'https://example.com/GHSA-2222-3333-4444' }] },
      },
    };
    expect(advisoryIds(many)).toEqual(['GHSA-gg6h-894w-4m9c', 'GHSA-mrhx-c7xc-m3w5']);
  });

  it('refuses an npm error report', () => {
    expect(() => advisoryIds({ error: { code: 'ENOLOCK', summary: 'x' } })).toThrow();
  });

  it('refuses something that is not an audit report', () => {
    for (const value of [null, [], {}]) {
      expect(() => advisoryIds(value)).toThrow();
    }
  });
});

describe('the command line', () => {
  const script = fileURLToPath(new URL('../../scripts/advisory-packages.ts', import.meta.url));
  const run = (args: string[], input: string) => spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });

  it('prints the advisory IDs with --ids', () => {
    const { status, stdout } = run(['--ids'], readFileSync(fixture, 'utf8'));
    expect(status).toBe(0);
    expect(stdout).toBe('GHSA-gg6h-894w-4m9c\n');
  });

  it('prints the packages for a GHSA ID', () => {
    const { status, stdout } = run(['GHSA-gg6h-894w-4m9c'], readFileSync(fixture, 'utf8'));
    expect(status).toBe(0);
    expect(stdout).toBe('re2js\n');
  });

  it('fails on an error report', () => {
    expect(run(['--ids'], '{"error":{"summary":"x"}}').status).toBe(1);
  });

  it('rejects anything but a GHSA ID or --ids', () => {
    expect(run(['nope'], '{}').status).toBe(2);
  });
});
