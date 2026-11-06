import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EDGE_LABELS_STORAGE_KEY, readStoredEdgeLabels, storeEdgeLabels } from '../../src/lib/edge-labels';

describe('edge labels preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the labels when nothing has been stored', () => {
    expect(readStoredEdgeLabels()).toBe('shown');
  });

  it('round-trips a stored preference', () => {
    storeEdgeLabels('hidden');
    expect(localStorage.getItem(EDGE_LABELS_STORAGE_KEY)).toBe('hidden');
    expect(readStoredEdgeLabels()).toBe('hidden');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(EDGE_LABELS_STORAGE_KEY, 'sideways');
    expect(readStoredEdgeLabels()).toBe('shown');
  });

  it('shows the labels rather than throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    expect(readStoredEdgeLabels()).toBe('shown');
  });

  it('does not throw when storage rejects a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storeEdgeLabels('hidden')).not.toThrow();
  });
});
