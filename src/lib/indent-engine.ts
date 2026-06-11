/**
 * Indent engines for paragraph designator placement.
 *
 * Two archetypes exist in policy:
 *
 * 1. Correspondence (SECNAV M-5216.5 Fig 7-8): each subdivision's
 *    designator aligns under the FIRST LETTER OF TEXT of its parent
 *    paragraph. The position is content-dependent — "12." shifts its
 *    children further right than "1." — so positions are computed from
 *    measured designator widths, never from fixed constants.
 *    Runover (wrapped) lines return to the left margin, never indented
 *    (M-5216.5 7-2.13; POLICY_COMPLIANCE_AUDIT.md line 43).
 *
 * 2. USMC directives (MCO 5215.1K para 33): fixed 4-space ladder.
 *    FixedLadderEngine preserves the pre-Phase-1 cascade until Phase 3
 *    retunes it to the Courier-measured 4-space ladder.
 *
 * Width measurement uses the generated Liberation metric tables
 * (src/lib/font-metrics.ts). Liberation Serif is metric-compatible with
 * Times New Roman and Liberation Mono with Courier New, so DOCX (laid
 * out by Word in TNR) and PDF (laid out in Liberation) land designators
 * at identical positions.
 *
 * Spacing after designators: two spaces after period designators
 * ("1.", "a."), one space after parenthesized designators ("(1)",
 * "(a)") — mirrors pre-existing emitter behavior, now in one place.
 */
import { ParagraphData } from '@/types';
import { SERIF_EM_WIDTHS, MONO_EM_WIDTHS } from './font-metrics';
import { generateCitation } from './paragraph-formatter';

export interface ParagraphIndentSpec {
  /** Designator string, e.g. "1.", "a.", "(1)". */
  citation: string;
  /** Non-breaking spaces between designator and text: 2 after ".", 1 after ")". */
  spacesAfter: number;
  /** Designator start position, twips from left margin (DOCX firstLine indent). */
  firstLineTwips: number;
  /** Position where text begins after designator and spaces, twips. */
  textStartTwips: number;
  /** Designator start position in PDF points. */
  firstLinePoints: number;
  /** Text start position in PDF points. */
  textStartPoints: number;
  /** Courier only meaningful: designator start as a character column. */
  prefixChars: number;
  /** Courier only meaningful: text start as a character column. */
  textStartChars: number;
}

export interface IndentEngine {
  computeSpecs(
    paragraphs: ParagraphData[],
    font: 'times' | 'courier',
    fontSizePt?: number,
  ): ParagraphIndentSpec[];
}

/**
 * Document types whose body paragraphs follow the correspondence
 * (relative, Fig 7-8) indent model. Directives and message/form types
 * are excluded; they keep their dedicated render paths until Phase 3/4.
 */
export function isCorrespondenceType(documentType: string | undefined): boolean {
  return !['mco', 'bulletin', 'change-transmittal', 'amhs', 'page11', 'aa-form'].includes(
    documentType ?? '',
  );
}

const TWIPS_PER_POINT = 20;

/** Sum of advance widths for `text`, in em units, from a metric table. */
function widthEm(text: string, table: Record<string, number>): number {
  let w = 0;
  for (const ch of text) {
    // Designators are lowercase by construction; lowercase defensively.
    const v = table[ch] ?? table[ch.toLowerCase()];
    // Unknown character: assume digit width. Defensive only — the
    // designator alphabet is fully covered by the generated table.
    w += v ?? table['0'];
  }
  return w;
}

/** Canonical single-count designator per level, for orphan-level fallback. */
const CANONICAL_DESIGNATORS = ['', '1.', 'a.', '(1)', '(a)', '1.', 'a.', '(1)', '(a)'];

export function spacesAfterCitation(citation: string): number {
  return citation.endsWith('.') ? 2 : 1;
}

export class RelativeIndentEngine implements IndentEngine {
  computeSpecs(
    paragraphs: ParagraphData[],
    font: 'times' | 'courier',
    fontSizePt: number = 12,
  ): ParagraphIndentSpec[] {
    const table = font === 'courier' ? MONO_EM_WIDTHS : SERIF_EM_WIDTHS;
    const spaceEm = table[' '];
    const specs: ParagraphIndentSpec[] = [];

    // textStartPt[l] / textStartCh[l]: where TEXT begins for the most
    // recent paragraph seen at level l. Children of level l read these.
    const textStartPt: (number | undefined)[] = [];
    const textStartCh: (number | undefined)[] = [];

    // If a level appears without its parent ever occurring (malformed
    // input), synthesize parent positions from canonical designators.
    const ensureParent = (level: number): void => {
      for (let l = 1; l < level; l++) {
        if (textStartPt[l] === undefined) {
          const basePt = l === 1 ? 0 : (textStartPt[l - 1] as number);
          const baseCh = l === 1 ? 0 : (textStartCh[l - 1] as number);
          const cite = CANONICAL_DESIGNATORS[l];
          const sp = spacesAfterCitation(cite);
          textStartPt[l] = basePt + (widthEm(cite, table) + sp * spaceEm) * fontSizePt;
          textStartCh[l] = baseCh + cite.length + sp;
        }
      }
    };

    paragraphs.forEach((p, index) => {
      const level = Math.min(Math.max(p.level, 1), 8);
      const { citation } = generateCitation(p, index, paragraphs);
      const sp = spacesAfterCitation(citation);

      ensureParent(level);
      const startPt = level === 1 ? 0 : (textStartPt[level - 1] as number);
      const startCh = level === 1 ? 0 : (textStartCh[level - 1] as number);

      const textPt = startPt + (widthEm(citation, table) + sp * spaceEm) * fontSizePt;
      const textCh = startCh + citation.length + sp;

      textStartPt[level] = textPt;
      textStartCh[level] = textCh;

      specs.push({
        citation,
        spacesAfter: sp,
        firstLineTwips: Math.round(startPt * TWIPS_PER_POINT),
        textStartTwips: Math.round(textPt * TWIPS_PER_POINT),
        firstLinePoints: Math.round(startPt * 100) / 100,
        textStartPoints: Math.round(textPt * 100) / 100,
        prefixChars: startCh,
        textStartChars: textCh,
      });
    });

    return specs;
  }
}

/**
 * USMC directive ladder (Phase 3 P3.2; MCO 5215.1K para 33).
 * Fixed 4-space typewriter ladder in Courier: the designator starts
 * at character column (level-1)*4; at Courier 12 one character
 * advances 7.2pt = 144 twips, so each level steps 576 twips
 * (480 twips at Courier 10). Runover (wrapped) lines return to the
 * LEFT MARGIN — consumers must not emit a hanging indent.
 *
 * Two spaces follow period designators (1. / a.), one space follows
 * parenthesized designators ((1) / (a)) — spacesAfterCitation.
 *
 * Pre-Phase-1 this table held a 0.25-inch (360-twip) cascade; the
 * Phase 3 retune replaced it per the plan (CORE_CONCEPTS_UPDATE_PLAN
 * Phase 3 item 2). Columns are character-defined, so the char fields
 * are authoritative and size-independent; twip fields derive from
 * the font size.
 */
export const COURIER_TWIPS_PER_CHAR: Record<number, number> = {
  10: 120, // 10pt * 0.6em advance * 20 twips/pt
  12: 144, // 12pt * 0.6em advance * 20 twips/pt
};

export const FIXED_LADDER: Record<number, { citationChars: number; textChars: number }> = {
  1: { citationChars: 0, textChars: 4 },
  2: { citationChars: 4, textChars: 8 },
  3: { citationChars: 8, textChars: 12 },
  4: { citationChars: 12, textChars: 16 },
  5: { citationChars: 16, textChars: 20 },
  6: { citationChars: 20, textChars: 24 },
  7: { citationChars: 24, textChars: 28 },
  8: { citationChars: 28, textChars: 32 },
};

export class FixedLadderEngine implements IndentEngine {
  computeSpecs(
    paragraphs: ParagraphData[],
    _font: 'times' | 'courier',
    fontSizePt: number = 12,
  ): ParagraphIndentSpec[] {
    // Directives are Courier-only (font-policy, G7); the ladder is
    // defined in character columns and scaled by the Courier advance.
    const tpc = COURIER_TWIPS_PER_CHAR[fontSizePt] ?? fontSizePt * 0.6 * 20;
    return paragraphs.map((p, index) => {
      // Level 0 = pre-formatted/verbatim line (template convention):
      // no generated designator, no designator spacing, left margin.
      if (p.level < 1) {
        return {
          citation: '',
          spacesAfter: 0,
          firstLineTwips: 0,
          textStartTwips: 0,
          firstLinePoints: 0,
          textStartPoints: 0,
          prefixChars: 0,
          textStartChars: 0,
        };
      }
      const level = Math.min(p.level, 8);
      const { citation } = generateCitation(p, index, paragraphs);
      const ladder = FIXED_LADDER[level];
      const firstLineTwips = ladder.citationChars * tpc;
      const textStartTwips = ladder.textChars * tpc;
      return {
        citation,
        spacesAfter: spacesAfterCitation(citation),
        firstLineTwips,
        textStartTwips,
        firstLinePoints: firstLineTwips / TWIPS_PER_POINT,
        textStartPoints: textStartTwips / TWIPS_PER_POINT,
        prefixChars: ladder.citationChars,
        textStartChars: ladder.textChars,
      };
    });
  }
}

/** USMC directive types using the fixed ladder (MCO 5215.1K). */
export function isDirectiveType(documentType: string): boolean {
  return ['mco', 'bulletin', 'change-transmittal'].includes(documentType);
}

export const relativeIndentEngine = new RelativeIndentEngine();
export const fixedLadderEngine = new FixedLadderEngine();
