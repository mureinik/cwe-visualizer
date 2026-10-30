// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { advisoryPackages, isGhsaId } from '../../scripts/advisory-packages.ts';

const report: unknown = JSON.parse(readFileSync(new URL('../fixtures/npm-audit.json', import.meta.url), 'utf8'));

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
