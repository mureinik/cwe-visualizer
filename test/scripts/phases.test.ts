// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { orderPhases, readPhases } from '../../scripts/phases.ts';

describe('readPhases', () => {
  it('reads standard phases in source order', () => {
    expect(readPhases([{ Phase: 'Implementation' }, { Phase: ['Architecture and Design', 'Operation'] }], '1')).toEqual([
      { name: 'Implementation' },
      { name: 'Architecture and Design' },
      { name: 'Operation' },
    ]);
  });

  it('reads a custom phase with its domain', () => {
    expect(readPhases([{ Custom_Phase: { '#text': 'Training', '@_Domain': 'AI' } }], '1')).toEqual([
      { name: 'Training', domain: 'AI' },
    ]);
  });

  it('lists a repeated phase once', () => {
    const custom = { '#text': 'Implementation & Physical Design', '@_Domain': 'Hardware' };
    expect(readPhases([{ Custom_Phase: custom }, { Custom_Phase: { ...custom } }], '1461')).toEqual([
      { name: 'Implementation & Physical Design', domain: 'Hardware' },
    ]);
  });

  it('keeps standard and AI Testing apart', () => {
    expect(readPhases([{ Phase: 'Testing', Custom_Phase: { '#text': 'Testing', '@_Domain': 'AI' } }], '1')).toEqual([
      { name: 'Testing' },
      { name: 'Testing', domain: 'AI' },
    ]);
  });

  it('trims whitespace', () => {
    expect(readPhases([{ Phase: '  Implementation\n' }], '1')).toEqual([{ name: 'Implementation' }]);
  });

  it('fails on an empty Phase, naming the CWE', () => {
    expect(() => readPhases([{ Phase: '' }], '123')).toThrow('CWE-123: empty Phase in Modes_Of_Introduction');
  });

  it('fails on a Custom_Phase with no Domain, naming the CWE', () => {
    expect(() => readPhases([{ Custom_Phase: 'Training' }], '123')).toThrow(
      'CWE-123: Custom_Phase Training has no Domain',
    );
  });

  it('fails on an empty Custom_Phase, naming the CWE', () => {
    expect(() => readPhases([{ Custom_Phase: { '@_Domain': 'AI' } }], '123')).toThrow(
      'CWE-123: empty Custom_Phase in Modes_Of_Introduction',
    );
  });
});

describe('orderPhases', () => {
  it('orders phases for the picker', () => {
    expect(
      orderPhases([
        { name: 'Training', domain: 'AI' },
        { name: 'Operation' },
        { name: 'Hardware Requirements', domain: 'Hardware' },
        { name: 'Policy' },
        { name: 'Implementation' },
      ]),
    ).toEqual([
      { name: 'Policy' },
      { name: 'Implementation' },
      { name: 'Operation' },
      { name: 'Training', domain: 'AI' },
      { name: 'Hardware Requirements', domain: 'Hardware' },
    ]);
  });

  it('puts an unknown name after the known ones of its domain, and an unknown domain last', () => {
    expect(
      orderPhases([
        { name: 'Alpha', domain: 'Quantum' },
        { name: 'Zeta' },
        { name: 'Decommissioning and End-of-Life' },
        { name: 'Reuse', domain: 'Hardware' },
        { name: 'Alpha', domain: 'AI' },
        { name: 'Training', domain: 'AI' },
      ]),
    ).toEqual([
      { name: 'Decommissioning and End-of-Life' },
      { name: 'Zeta' },
      { name: 'Training', domain: 'AI' },
      { name: 'Alpha', domain: 'AI' },
      { name: 'Reuse', domain: 'Hardware' },
      { name: 'Alpha', domain: 'Quantum' },
    ]);
  });

  it('drops duplicates', () => {
    expect(orderPhases([{ name: 'Policy' }, { name: 'Policy' }])).toEqual([{ name: 'Policy' }]);
  });
});
