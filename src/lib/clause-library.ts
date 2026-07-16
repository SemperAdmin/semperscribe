/**
 * P3.5 (DONDOCS_PARITY_PLAN) - clause library.
 *
 * Preset closing/boilerplate clauses plus user-saved custom clauses
 * persisted through the storage-utils envelope (same localStorage
 * discipline as the user profile).
 */

import { z } from 'zod';
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage-utils';

export interface Clause {
  id: string;
  name: string;
  content: string;
  custom?: boolean;
}

export const PRESET_CLAUSES: Clause[] = [
  {
    id: 'poc-closing',
    name: 'Point of contact',
    content: 'The point of contact for this matter is [NAME], who may be reached at [PHONE] or [EMAIL].',
  },
  {
    id: 'request-action',
    name: 'Request for action',
    content: 'Request favorable consideration of the above. A response by [DATE] is requested to meet [REQUIREMENT].',
  },
  {
    id: 'no-action',
    name: 'Information only',
    content: 'This correspondence is provided for information only. No action is required.',
  },
  {
    id: 'recommend-approval',
    name: 'Recommend approval',
    content: 'Recommend approval of the enclosed request.',
  },
  {
    id: 'cancellation',
    name: 'Directive cancellation',
    content: 'This Order is effective the date signed and remains in effect until superseded or cancelled.',
  },
];

const clauseSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  custom: z.boolean().optional(),
}));

export function loadCustomClauses(): Clause[] {
  return readStorage(STORAGE_KEYS.customClauses, clauseSchema) ?? [];
}

export function saveCustomClause(name: string, content: string): Clause[] {
  const existing = loadCustomClauses();
  const clause: Clause = {
    id: `custom-${Date.now()}`,
    name: name.trim() || content.slice(0, 30),
    content,
    custom: true,
  };
  const updated = [...existing, clause];
  writeStorage(STORAGE_KEYS.customClauses, updated);
  return updated;
}

export function deleteCustomClause(id: string): Clause[] {
  const updated = loadCustomClauses().filter((c) => c.id !== id);
  writeStorage(STORAGE_KEYS.customClauses, updated);
  return updated;
}

export function allClauses(custom: Clause[] = loadCustomClauses()): Clause[] {
  return [...PRESET_CLAUSES, ...custom];
}
