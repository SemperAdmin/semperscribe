/**
 * P3.5 (DONDOCS_PARITY_PLAN) - clause library persistence.
 * jsdom provides localStorage in the local vitest environment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PRESET_CLAUSES, loadCustomClauses, saveCustomClause, deleteCustomClause, allClauses } from '@/lib/clause-library';
import { STORAGE_KEYS } from '@/lib/storage-utils';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEYS.customClauses);
});

describe('clause library', () => {
  it('ships presets including POC and request-for-action', () => {
    const ids = PRESET_CLAUSES.map((c) => c.id);
    expect(ids).toContain('poc-closing');
    expect(ids).toContain('request-action');
  });

  it('starts with no custom clauses', () => {
    expect(loadCustomClauses()).toEqual([]);
  });

  it('saves and reloads a custom clause through the envelope', () => {
    saveCustomClause('My closer', 'Semper Fidelis.');
    const loaded = loadCustomClauses();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('My closer');
    expect(loaded[0].content).toBe('Semper Fidelis.');
    expect(loaded[0].custom).toBe(true);
  });

  it('deletes by id', () => {
    const saved = saveCustomClause('A', 'a content');
    const remaining = deleteCustomClause(saved[0].id);
    expect(remaining).toEqual([]);
    expect(loadCustomClauses()).toEqual([]);
  });

  it('falls back to a content-derived name for blank names', () => {
    saveCustomClause('   ', 'A very long clause body used to derive the fallback name.');
    expect(loadCustomClauses()[0].name).toBe('A very long clause body used t');
  });

  it('allClauses lists presets before custom', () => {
    saveCustomClause('Custom one', 'text');
    const all = allClauses();
    expect(all.length).toBe(PRESET_CLAUSES.length + 1);
    expect(all[all.length - 1].custom).toBe(true);
  });
});
