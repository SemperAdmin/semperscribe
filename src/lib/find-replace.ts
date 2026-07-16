/**
 * P3.1 (DONDOCS_PARITY_PLAN) - find and replace over document fields.
 *
 * Pure functions: document slices in, counts and replaced slices out.
 * The caller routes results through the normal setters, so undo
 * history captures the operation automatically.
 */

import { FormData, ParagraphData } from '@/types';

export interface FindReplaceScope {
  subject: boolean;
  body: boolean;
  references: boolean;
  addresses: boolean; // from, to, vias, copy-tos
  enclosures: boolean;
}

export interface FindReplaceOptions {
  find: string;
  replace: string;
  caseSensitive: boolean;
  scope: FindReplaceScope;
}

export interface FindReplaceInput {
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
}

export interface FieldCount {
  field: string;
  count: number;
}

export const DEFAULT_SCOPE: FindReplaceScope = {
  subject: true,
  body: true,
  references: true,
  addresses: true,
  enclosures: true,
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matcher(options: FindReplaceOptions): RegExp {
  return new RegExp(escapeRegExp(options.find), options.caseSensitive ? 'g' : 'gi');
}

function countIn(text: string, options: FindReplaceOptions): number {
  if (!text || !options.find) return 0;
  return (text.match(matcher(options)) ?? []).length;
}

function replaceIn(text: string, options: FindReplaceOptions): string {
  if (!text || !options.find) return text;
  return text.replace(matcher(options), options.replace);
}

/**
 * Counts matches per field group without changing anything.
 */
export function countMatches(input: FindReplaceInput, options: FindReplaceOptions): FieldCount[] {
  if (!options.find) return [];
  const counts: FieldCount[] = [];
  const { scope } = options;

  if (scope.subject) {
    counts.push({ field: 'Subject', count: countIn(input.formData.subj ?? '', options) });
  }
  if (scope.body) {
    const body = input.paragraphs.reduce((sum, p) => sum + countIn(p.content, options), 0);
    counts.push({ field: 'Body paragraphs', count: body });
  }
  if (scope.references) {
    counts.push({ field: 'References', count: input.references.reduce((s, r) => s + countIn(r, options), 0) });
  }
  if (scope.enclosures) {
    counts.push({ field: 'Enclosures', count: input.enclosures.reduce((s, e) => s + countIn(e, options), 0) });
  }
  if (scope.addresses) {
    const addresses =
      countIn(input.formData.from ?? '', options) +
      countIn(input.formData.to ?? '', options) +
      input.vias.reduce((s, v) => s + countIn(v, options), 0) +
      input.copyTos.reduce((s, c) => s + countIn(c, options), 0);
    counts.push({ field: 'Addresses (From/To/Via/Copy to)', count: addresses });
  }
  return counts.filter((c) => c.count > 0 || true);
}

export function totalMatches(input: FindReplaceInput, options: FindReplaceOptions): number {
  return countMatches(input, options).reduce((sum, c) => sum + c.count, 0);
}

export interface FindReplaceResult {
  replaced: number;
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
}

/**
 * Replace-all across the selected scope. Returns new slices; the
 * caller applies them through the normal setters.
 */
export function replaceAll(input: FindReplaceInput, options: FindReplaceOptions): FindReplaceResult {
  const replaced = totalMatches(input, options);
  const { scope } = options;

  const formData: FormData = { ...input.formData };
  if (scope.subject && formData.subj) formData.subj = replaceIn(formData.subj, options);
  if (scope.addresses) {
    if (formData.from) formData.from = replaceIn(formData.from, options);
    if (formData.to) formData.to = replaceIn(formData.to, options);
  }

  return {
    replaced,
    formData,
    paragraphs: scope.body
      ? input.paragraphs.map((p) => ({ ...p, content: replaceIn(p.content, options) }))
      : input.paragraphs,
    vias: scope.addresses ? input.vias.map((v) => replaceIn(v, options)) : input.vias,
    references: scope.references ? input.references.map((r) => replaceIn(r, options)) : input.references,
    enclosures: scope.enclosures ? input.enclosures.map((e) => replaceIn(e, options)) : input.enclosures,
    copyTos: scope.addresses ? input.copyTos.map((c) => replaceIn(c, options)) : input.copyTos,
  };
}
