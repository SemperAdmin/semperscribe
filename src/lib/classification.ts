/**
 * P2 (DONDOCS_PARITY_PLAN) - classification marking engine.
 *
 * Pure functions: marking configuration in, banner text, portion
 * prefixes, CUI designation block content, and consistency issues out.
 * Rendering lives in the PDF/DOCX generators; nothing here touches
 * storage or the DOM.
 *
 * Posture (ruling 2026-07-15): markings are formatting OUTPUT. The app
 * still stores nothing server-side, and the PoC disclaimer stays.
 * Levels above CUI exist for training or exercise output only and
 * always carry a warning - this tool is not an authorized system for
 * classified material.
 *
 * Layout authority: DoDI 5200.48 (CUI marking), DoDM 5200.01 V2
 * (banner and portion conventions).
 */

import { FormData, ParagraphData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';

export interface CuiDesignation {
  /** "Controlled by:" lines - office chain, most specific last. */
  controlledBy: string;
  /** CUI category or categories, e.g. "PRVCY" or "CTI, PRVCY". */
  categories: string;
  /** Limited dissemination control or distribution statement, e.g. "FEDCON". */
  distribution: string;
  /** Point of contact, e.g. "GySgt Smith, DSN 555-0100". */
  poc: string;
}

export interface ClassificationConfig {
  enabled: boolean;
  /** Banner level: UNCLASSIFIED, CUI, or a training/custom level. */
  level: string;
  /** Training gate - unlocks levels above CUI and free-text levels. */
  customLevels: boolean;
  /** Per-paragraph portion markings on or off. */
  portionMarking: boolean;
  cui: CuiDesignation;
}

export const DEFAULT_CLASSIFICATION: ClassificationConfig = {
  enabled: false,
  level: 'UNCLASSIFIED',
  customLevels: false,
  portionMarking: false,
  cui: { controlledBy: '', categories: '', distribution: '', poc: '' },
};

export const STANDARD_LEVELS = ['UNCLASSIFIED', 'CUI'] as const;
export const TRAINING_LEVELS = ['CONFIDENTIAL', 'SECRET', 'TOP SECRET'] as const;

const LEVEL_RANK: Record<string, number> = {
  'UNCLASSIFIED': 0,
  'U': 0,
  'CUI': 1,
  'CONFIDENTIAL': 2,
  'C': 2,
  'SECRET': 3,
  'S': 3,
  'TOP SECRET': 4,
  'TS': 4,
};

const PORTION_ABBREVIATION: Record<string, string> = {
  'UNCLASSIFIED': 'U',
  'CUI': 'CUI',
  'CONFIDENTIAL': 'C',
  'SECRET': 'S',
  'TOP SECRET': 'TS',
};

export function normalizeLevel(level: string): string {
  return level.trim().toUpperCase();
}

/**
 * Rank for consistency comparison. Unknown custom levels rank above
 * everything known, forcing the banner to name them explicitly.
 */
export function levelRank(level: string): number {
  const rank = LEVEL_RANK[normalizeLevel(level)];
  return rank === undefined ? 5 : rank;
}

/** Portion prefix, e.g. "(U)", "(CUI)", "(TS)". Custom levels use initials. */
export function portionPrefix(level: string): string {
  const normalized = normalizeLevel(level);
  const known = PORTION_ABBREVIATION[normalized];
  if (known) return `(${known})`;
  const initials = normalized
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('');
  return `(${initials || 'U'})`;
}

/** Banner line rendered top and bottom of every page. */
export function bannerText(config: ClassificationConfig): string {
  return normalizeLevel(config.level) || 'UNCLASSIFIED';
}

/** The CUI designation indicator block renders only on CUI documents. */
export function needsCuiBlock(config: ClassificationConfig): boolean {
  return config.enabled && normalizeLevel(config.level) === 'CUI';
}

/** Designation indicator block lines (page 1, DoDI 5200.48 para 3.4). */
export function cuiBlockLines(config: ClassificationConfig): string[] {
  const cui = config.cui;
  const lines: string[] = [];
  const controlledBy = cui.controlledBy.split('\n').map((l) => l.trim()).filter(Boolean);
  if (controlledBy.length === 0) controlledBy.push('');
  controlledBy.forEach((line) => lines.push(`Controlled by: ${line}`));
  lines.push(`CUI Category: ${cui.categories}`);
  lines.push(`Distribution/Dissemination Control: ${cui.distribution}`);
  lines.push(`POC: ${cui.poc}`);
  return lines;
}

/** Reads the config off the loose FormData bag, defaulting to off. */
export function getClassification(formData: FormData): ClassificationConfig {
  const raw = formData.classification as Partial<ClassificationConfig> | undefined;
  if (!raw) return DEFAULT_CLASSIFICATION;
  return {
    ...DEFAULT_CLASSIFICATION,
    ...raw,
    cui: { ...DEFAULT_CLASSIFICATION.cui, ...(raw.cui ?? {}) },
  };
}

/** Effective portion level for a paragraph (falls back to the banner). */
export function paragraphLevel(paragraph: ParagraphData, config: ClassificationConfig): string {
  return paragraph.marking?.trim() ? paragraph.marking : config.level;
}

/**
 * P2.4 consistency validation - the check DonDocs does not perform.
 */
export function validateClassification(
  formData: FormData,
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const config = getClassification(formData);
  if (!config.enabled) return issues;

  const bannerRank = levelRank(config.level);

  if (needsCuiBlock(config)) {
    const cui = config.cui;
    const missing = [
      !cui.controlledBy.trim() && 'Controlled by',
      !cui.categories.trim() && 'CUI Category',
      !cui.distribution.trim() && 'Distribution/Dissemination Control',
      !cui.poc.trim() && 'POC',
    ].filter(Boolean);
    if (missing.length > 0) {
      issues.push({
        id: 'cui-block-incomplete',
        severity: 'fail',
        rule: `CUI designation indicator block is incomplete: ${missing.join(', ')}`,
        citation: 'DoDI 5200.48 para 3.4',
        detail: 'Every CUI document must carry a complete designation indicator block on page 1.',
      });
    }
  }

  if (config.portionMarking) {
    const contentParagraphs = paragraphs.filter((p) => p.content.trim());
    const unmarked = contentParagraphs.filter((p) => !p.marking?.trim());
    if (unmarked.length > 0) {
      issues.push({
        id: 'portion-markings-missing',
        severity: 'warn',
        rule: `${unmarked.length} paragraph${unmarked.length === 1 ? '' : 's'} without a portion marking (banner level assumed)`,
        citation: 'DoDM 5200.01 V2',
        detail: 'With portion marking on, every paragraph carries its own marking. Unmarked paragraphs inherit the banner level.',
      });
    }

    const maxPortion = contentParagraphs.reduce(
      (max, p) => Math.max(max, levelRank(paragraphLevel(p, config))),
      0,
    );
    if (maxPortion > bannerRank) {
      issues.push({
        id: 'portion-exceeds-banner',
        severity: 'fail',
        rule: 'A portion marking exceeds the banner level',
        citation: 'DoDM 5200.01 V2',
        detail: 'The banner must equal or exceed the highest portion marking in the document. Raise the banner or lower the portion.',
      });
    }
  }

  if (bannerRank >= 2) {
    issues.push({
      id: 'training-level-warning',
      severity: 'warn',
      rule: `"${normalizeLevel(config.level)}" markings are for training or exercise output only`,
      citation: 'App posture - non-official proof of concept',
      detail: 'This tool is not an authorized system for classified material. Use levels above CUI only on exercise documents.',
    });
  }

  return issues;
}
