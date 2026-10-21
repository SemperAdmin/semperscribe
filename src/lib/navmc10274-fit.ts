/**
 * NAVMC 10274 fit: does the text fit the official form's boxes?
 *
 * Every box on the form is fixed height and Acrobat clips what does not
 * fit, so this is the one check that stands between a drafter and a form
 * with its tail cut off. It reads the same layout module as both
 * renderers (src/lib/navmc10274-layout.ts), so what it counts is what
 * they draw.
 *
 * Severities (owner's ruling, 2026-10-21): text past block 12 continues
 * in block 13 and is a note; text past block 13 has nowhere to go and
 * BLOCKS the export; a small box that overflows is a warning naming the
 * block, because the preview shows the clipped lines and the drafter may
 * decide the abbreviation themselves.
 */
import type { FormData, ParagraphData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import {
  AA_BLOCK_LABELS,
  NAVMC10274_FIELDS,
  aaFieldValues,
  aaLineCapacity,
  aaLinesFor,
  flowAaBody,
  type AaBodyFlow,
  type AaField,
} from '@/lib/navmc10274-layout';

export interface AaBoxOverflow {
  field: AaField;
  lines: number;
  capacity: number;
  formField?: string;
}

export interface AaFitReport {
  flow: AaBodyFlow;
  /** Small boxes whose text takes more lines than they hold. */
  overflows: AaBoxOverflow[];
  /** Lines block 12 holds, then block 13. */
  capacity: { block12: number; block13: number };
}

export interface AaFitInputs {
  formData: FormData;
  vias: readonly string[];
  references: readonly string[];
  enclosures: readonly string[];
  copyTos: readonly string[];
  paragraphs: readonly ParagraphData[];
}

export function navmc10274FitReport(inputs: AaFitInputs): AaFitReport {
  const flow = flowAaBody(inputs.paragraphs, inputs.formData.sig || '');
  const overflows: AaBoxOverflow[] = [];
  for (const { field, value, formField } of aaFieldValues(inputs)) {
    if (!value.trim()) continue;
    const lines = aaLinesFor(value, field);
    const capacity = aaLineCapacity(field);
    if (lines > capacity) overflows.push({ field, lines, capacity, formField });
  }
  return {
    flow,
    overflows,
    capacity: {
      block12: aaLineCapacity(NAVMC10274_FIELDS.SuppInfo),
      block13: aaLineCapacity(NAVMC10274_FIELDS.ProcAct),
    },
  };
}

const CITATION = 'NAVMC 10274 field capacity, measured on the official blank (docs/NAVMC_10274_LAYOUT_PLAN.md)';

/** Validator for the compliance dialog and the export gate. A no-op for every other document type. */
export function validateNavmc10274Fit(
  formData: FormData,
  vias: readonly string[],
  references: readonly string[],
  enclosures: readonly string[],
  paragraphs: readonly ParagraphData[],
): ValidationIssue[] {
  if (formData.documentType !== 'aa-form') return [];
  const report = navmc10274FitReport({
    formData, vias, references, enclosures, paragraphs,
    copyTos: formData.copyTos ?? [],
  });
  const issues: ValidationIssue[] = [];
  const { flow, capacity } = report;
  if (!flow.fits) {
    const over = flow.block13.length - capacity.block13;
    issues.push({
      id: 'aa-form-body-overflow',
      severity: 'block',
      rule: `Blocks 12 and 13 hold ${capacity.block12 + capacity.block13} lines; the paragraphs and the typed name take ${flow.totalLines}, ${over} past block 13.`,
      citation: CITATION,
      detail: 'The official form has no further page and Acrobat clips what does not fit. Shorten the paragraphs or move detail into an enclosure.',
    });
  } else if (flow.block13.length > 0) {
    issues.push({
      id: 'aa-form-block13',
      severity: 'warn',
      rule: `Block 12 is full at ${flow.block12.length} lines; ${flow.block13.length} line${flow.block13.length === 1 ? '' : 's'} continue in block 13 (Processing Action) on page 3.`,
      citation: 'Owner\'s ruling of 2026-10-21: block 13 is the continuation box; the processing chain endorses on a separate page',
      detail: flow.signatureBlock === 13
        ? 'The typed name lands in block 13. Shorten the paragraphs to keep it under the text in block 12.'
        : 'Both the preview and the official export continue the text there.',
    });
  }
  for (const o of report.overflows) {
    const label = AA_BLOCK_LABELS[o.field.block];
    issues.push({
      id: `aa-form-box-${o.field.block}`,
      severity: 'warn',
      rule: `Block ${o.field.block} (${label}) holds ${o.capacity} line${o.capacity === 1 ? '' : 's'} at ${o.field.fontSize} pt; the text takes ${o.lines}.`,
      citation: CITATION,
      detail: 'Acrobat clips the lines past the box; the preview marks how many. Shorten or abbreviate the entry.',
      field: o.formField,
    });
  }
  return issues;
}

/** One-line notes for the export toast, in the order a drafter reads the form. */
export function describeAaFit(report: AaFitReport): string[] {
  const notes: string[] = [];
  for (const o of report.overflows) {
    notes.push(`Block ${o.field.block} (${AA_BLOCK_LABELS[o.field.block]}) takes ${o.lines} lines and holds ${o.capacity}.`);
  }
  if (report.flow.block13.length > 0 && report.flow.fits) {
    const n = report.flow.block13.length;
    notes.push(`Block 12 is full; ${n} line${n === 1 ? '' : 's'} continue${n === 1 ? 's' : ''} in block 13 on page 3.`);
  }
  return notes;
}
