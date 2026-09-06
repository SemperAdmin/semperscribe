/**
 * E.5 - the same-page endorsement written from scratch: one document,
 * two halves, two signers (owner's model, 2026-09-06).
 *
 * The main sections of a same-page endorsement are the basic letter,
 * signed by signer 1. The endorsement part, kept under
 * `formData.samePageEndorsement`, is the second half: its own From and
 * To, the remaining Vias, its Ser line and date, its body, signer 2,
 * its Copy to, and any references or enclosures it adds. The render
 * draws the letter, draws the endorsement as the block, and composes
 * the two with the Figure 9-1 rule between them (9-1, 9-2, Figure 9-1
 * of SECNAV M-5216.5), falling back to a new page when the block does
 * not fit.
 *
 * Addressing follows 9-2.2 and the figure. With a Via chain, the first
 * Via endorses: From is the first Via, To stays the letter's action
 * addressee, and the remaining Vias carry forward. With no Via, the
 * addressee endorses back to the writer, which reverses From and To;
 * 9-1 says not to reply to a routine letter by endorsement, so that
 * case carries a warning, not a block.
 */
import type { FormData, ParagraphData, SamePageEndorsementPart } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import { isSamePageEndorsement } from '@/lib/same-page-endorsement';

export type { SamePageEndorsementPart };

/** The slices a render takes. Structural, so lib/ stays clear of services/. */
export interface RenderContext {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
  distList?: string[];
}

export const EMPTY_PARAGRAPHS: ParagraphData[] = [{ id: 1, level: 1, content: '' }];

export function emptySamePagePart(): SamePageEndorsementPart {
  return {
    from: '', to: '', vias: [], originatorCode: '', date: '',
    paragraphs: [{ id: 1, level: 1, content: '' }],
    sig: '', delegationText: '', copyTos: [], references: [], enclosures: [],
  };
}

/** True for a same-page endorsement carrying the two-half model. */
export function hasSamePageComposite(formData: Pick<FormData, 'documentType' | 'endorsementPlacement' | 'samePageEndorsement'>): boolean {
  return isSamePageEndorsement(formData) && !!formData.samePageEndorsement;
}

export function samePagePart(formData: FormData): SamePageEndorsementPart {
  return { ...emptySamePagePart(), ...(formData.samePageEndorsement ?? {}) };
}

export interface LetterAddressing { from: string; to: string; vias: string[] }
export interface DerivedAddressing extends LetterAddressing {
  /** True when the endorsement goes back to the letter's writer (no Via). */
  replies: boolean;
}

/**
 * 9-2.2 and Figure 9-1: the first Via endorses to the action addressee
 * with the remaining Vias carried forward. With no Via, the addressee
 * endorses back to the writer.
 */
export function deriveEndorsementAddressing(letter: LetterAddressing): DerivedAddressing {
  const vias = letter.vias.map((v) => v.trim()).filter(Boolean);
  if (vias.length > 0) {
    return { from: vias[0], to: letter.to.trim(), vias: vias.slice(1), replies: false };
  }
  return { from: letter.to.trim(), to: letter.from.trim(), vias: [], replies: true };
}

/**
 * The letter in reference style for an endorsement line (9-2.1.b,
 * Figure 9-1: "NAS Meridian ltr 5216 Ser 11/273 of 22 Apr 15"). The
 * writer's title stands in for the command's short name; the drafter
 * edits it in the endorsement card when a shorter form is wanted.
 */
export function derivedBasicLetterReference(formData: FormData): string {
  const who = String(formData.from ?? '').trim();
  const ssic = String(formData.ssic ?? '').trim();
  const ser = String(formData.originatorCode ?? '').trim();
  const date = String(formData.date ?? '').trim();
  const parts = [who ? `${who} ltr` : 'ltr', ssic, ser, date ? `of ${date}` : ''].filter(Boolean);
  return parts.join(' ').trim();
}

/** Letter after the letter's last reference: c after (a) and (b) (9-2.3). */
export function nextReferenceLetter(letterReferences: string[], startingLevel: string = 'a'): string {
  const count = letterReferences.filter((r) => r.trim()).length;
  const start = (startingLevel || 'a').toLowerCase().charCodeAt(0) - 97;
  return String.fromCharCode(97 + Math.min(start + count, 25));
}

/** Number after the letter's last enclosure (9-2.4). */
export function nextEnclosureNumber(letterEnclosures: string[], startingNumber: string = '1'): string {
  const count = letterEnclosures.filter((e) => e.trim()).length;
  const start = parseInt(startingNumber || '1', 10) || 1;
  return String(start + count);
}

/** A render context with every slice present. */
export type FullRenderContext = RenderContext & { distList: string[] };

/** The top half: the main sections rendered as the basic letter, signer 1. */
export function letterContext(ctx: RenderContext): FullRenderContext {
  const { formData } = ctx;
  return {
    ...ctx,
    distList: ctx.distList ?? [],
    formData: {
      ...formData,
      documentType: 'basic',
      endorsementLevel: '',
      endorsementPlacement: undefined,
      samePageOmitsIdentification: undefined,
      samePageRenderAsBlock: undefined,
      samePageEndorsement: undefined,
      samePageHost: undefined,
      basicLetterReference: '',
      startingPageNumber: 1,
      previousPackagePageCount: 0,
    },
  };
}

/** The bottom half: the endorsement part rendered as the endorsement, signer 2. */
export function endorsementContext(ctx: RenderContext): FullRenderContext {
  const { formData } = ctx;
  const part = samePagePart(formData);
  return {
    formData: {
      ...formData,
      documentType: 'endorsement',
      endorsementPlacement: 'same-page',
      from: part.from,
      to: part.to,
      originatorCode: part.originatorCode,
      date: part.date,
      sig: part.sig,
      delegationText: part.delegationText,
      basicLetterReference: part.basicLetterReference || derivedBasicLetterReference(formData),
      startingReferenceLevel: nextReferenceLetter(ctx.references, formData.startingReferenceLevel),
      startingEnclosureNumber: nextEnclosureNumber(ctx.enclosures, formData.startingEnclosureNumber),
      samePageEndorsement: undefined,
    },
    vias: part.vias,
    references: part.references,
    enclosures: part.enclosures,
    copyTos: part.copyTos,
    paragraphs: part.paragraphs.length > 0 ? part.paragraphs : EMPTY_PARAGRAPHS,
    distList: [],
  };
}

/**
 * A same-page endorsement saved before E.5 kept the endorsement in the
 * main fields. Move them into the part so the main sections become the
 * letter, and hand back the slices the letter should start with.
 */
export function migrateLegacySamePage(formData: FormData, slices: {
  vias: string[]; references: string[]; enclosures: string[]; copyTos: string[]; paragraphs: ParagraphData[];
}): { formData: FormData; vias: string[]; references: string[]; enclosures: string[]; copyTos: string[]; paragraphs: ParagraphData[] } | null {
  if (!isSamePageEndorsement(formData) || formData.samePageEndorsement) return null;
  const part: SamePageEndorsementPart = {
    from: String(formData.from ?? ''),
    to: String(formData.to ?? ''),
    vias: slices.vias.filter((v) => v.trim()),
    originatorCode: String(formData.originatorCode ?? ''),
    date: String(formData.date ?? ''),
    paragraphs: slices.paragraphs.length > 0 ? slices.paragraphs : [{ id: 1, level: 1, content: '' }],
    sig: String(formData.sig ?? ''),
    delegationText: String(formData.delegationText ?? ''),
    copyTos: slices.copyTos.filter((c) => c.trim()),
    references: slices.references.filter((r) => r.trim()),
    enclosures: slices.enclosures.filter((e) => e.trim()),
    addressingEdited: true,
    basicLetterReference: String(formData.basicLetterReference ?? '') || undefined,
  };
  return {
    formData: { ...formData, samePageEndorsement: part, from: '', to: '', sig: '', delegationText: '' },
    vias: [''],
    references: [''],
    enclosures: [''],
    copyTos: [''],
    paragraphs: [{ id: 1, level: 1, content: '', acronymError: '' }],
  };
}

/** Rules for the two-half document, cited. */
export function validateSamePageComposite(formData: FormData): ValidationIssue[] {
  if (!hasSamePageComposite(formData)) return [];
  if (formData.samePageHost) return [];
  const part = samePagePart(formData);
  const issues: ValidationIssue[] = [];
  const has = (v: string) => v.trim().length > 0;
  if (!has(part.from)) {
    issues.push({ id: 'same-page-endorsement-from', severity: 'block', rule: 'The endorsement carries its own From line', citation: 'M-5216.5 9-2, Figure 9-1', detail: 'The endorsement half has no From. It is derived from the letter\'s first Via, or its addressee when there is no Via.', field: 'samePageEndorsement.from' });
  }
  if (!has(part.to)) {
    issues.push({ id: 'same-page-endorsement-to', severity: 'block', rule: 'The endorsement carries its own To line', citation: 'M-5216.5 9-2, Figure 9-1', detail: 'The endorsement half has no To.', field: 'samePageEndorsement.to' });
  }
  if (!has(part.sig)) {
    issues.push({ id: 'same-page-endorsement-sig', severity: 'block', rule: 'The endorsement is signed by the endorser', citation: 'M-5216.5 9-2, Figure 9-1', detail: 'The endorsement half has no signature name. It is the second signer, not the letter\'s.', field: 'samePageEndorsement.sig' });
  }
  if (!part.paragraphs.some((p) => p.content.trim())) {
    issues.push({ id: 'same-page-endorsement-body', severity: 'block', rule: 'The endorsement carries at least one paragraph', citation: 'M-5216.5 9-1, Figure 9-1', detail: 'The endorsement half has no text. Even a routine endorsement reads "Forwarded" or "Forwarded, recommending approval."', field: 'samePageEndorsement.paragraphs' });
  }
  if (has(part.to) && has(String(formData.from ?? '')) && part.to.trim() === String(formData.from).trim()) {
    issues.push({ id: 'same-page-endorsement-reply', severity: 'warn', rule: 'An endorsement forwards; it does not reply to a routine letter', citation: 'M-5216.5 9-1', detail: `The endorsement is addressed back to the letter's writer, ${part.to.trim()}. 9-1: "Do not use an endorsement to reply to a routine letter." Approving a request this way is common practice; a reply to a routine letter is a letter.`, field: 'samePageEndorsement.to' });
  }
  return issues;
}
