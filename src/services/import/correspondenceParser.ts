import { ParagraphData } from '@/types';
import { validateSSIC, validateSubject, validateFromTo } from '@/lib/validation-utils';
import { parseAndFormatDate } from '@/lib/date-utils';
import {
  Confidence,
  ExtractedFieldMap,
  ExtractedFieldName,
  ExtractedText,
  ExtractionResult,
} from './extractionTypes';

/**
 * Rule-based parser for naval correspondence (SECNAV M-5216.5 conventions).
 *
 * Takes normalized text extracted from a .docx/.pdf and recovers the app's
 * metadata fields by scanning for the format's anchors: letterhead lines,
 * SSIC/originator/date header block, From/To/Via/Subj/Ref/Encl labels,
 * numbered body paragraphs (1. / a. / (1) / (a)), signature block,
 * "Copy to:" and "Distribution:" lists.
 *
 * Tolerant of common mangling: label case variants, hard-wrapped lines,
 * hyphenated wraps, list items collapsed onto one line, missing blank lines.
 * Every extracted value carries a confidence flag (reusing the app's field
 * validators) and unclaimed source text is reported, never dropped silently.
 */

const ANCHOR_RE = /^(from|to|via|subj(?:ect)?|refs?|references?|encls?|enclosures?)\s*[:.]\s*(.*)$/i;
const CLOSING_ANCHOR_RE = /^(copy\s*to|distribution)\s*[:.]?\s*(.*)$/i;
const SERVICE_LINE_RE = /(UNITED STATES MARINE CORPS|DEPARTMENT OF THE NAVY|UNITED STATES NAVY|DEFENSE LOGISTICS AGENCY)/i;
const MEMO_HEADING_RE = /^MEMORANDUM(\s+(FOR THE RECORD|OF AGREEMENT|OF UNDERSTANDING|FOR\b.*))?$/i;
const IN_REPLY_RE = /^in reply refer to[:.]?$/i;
const STANDALONE_SSIC_RE = /^(\d{4,5})((?:\.\d+[A-Za-z]?)?)\.?$/;
const ORIGINATOR_RE = /^[A-Za-z]{1,5}(?:[-/ ]?\d{1,4}[A-Za-z]?)?$/;
/** SSIC, originator code, and date collapsed onto one line by extraction. */
const COMBINED_HEADER_RE = /^(\d{4,5})\s+(\S{1,8})\s+(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4})$/;
const LEVEL1_RE = /^(\d{1,2})\.\s+(\S.*)$/;
const LEVEL2_RE = /^([a-z])\.\s+(\S.*)$/;
const LEVEL3_RE = /^\((\d{1,2})\)\s+(\S.*)$/;
const LEVEL4_RE = /^\(([a-z])\)\s+(\S.*)$/;
const NAME_LINE_RE = /^[A-Z][A-Z.'’-]*(?:\s+[A-Z][A-Z.'’-]*){1,3}$/;
const DELEGATION_RE = /^(by direction\b.*|acting)$/i;

type AnchorKey = 'from' | 'to' | 'via' | 'subj' | 'ref' | 'encl';

interface OpenAnchor {
  key: AnchorKey;
  parts: string[];
  sourceLines: number[];
}

/**
 * Normalizes raw multi-line text into the line array used by the parser:
 * CRLF/CR to LF, tabs and non-breaking spaces to spaces, internal whitespace
 * runs collapsed, lines trimmed, blank-line runs collapsed to one, and
 * leading/trailing blank lines dropped.
 */
export function linesFromText(raw: string): string[] {
  const normalized = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[\t ]/g, ' ').replace(/ {2,}/g, ' ').trim());

  const out: string[] = [];
  for (const line of normalized) {
    if (line === '' && out[out.length - 1] === '') continue;
    out.push(line);
  }
  while (out[0] === '') out.shift();
  while (out[out.length - 1] === '') out.pop();
  return out;
}

/** Joins a wrapped continuation, repairing hyphenated line breaks. */
function joinLine(acc: string, next: string): string {
  if (!acc) return next;
  if (/[A-Za-z]-$/.test(acc) && /^[a-z]/.test(next)) return acc.slice(0, -1) + next;
  return `${acc} ${next}`;
}

/**
 * Splits an anchor value like "(a) MCO 5215.1K (b) SECNAV M-5216.5" into
 * items on its markers. Text before the first marker is kept as an item;
 * with no markers at all the whole text is a single item.
 */
function splitMarkedItems(text: string, markerRe: RegExp): string[] {
  const matches = [...text.matchAll(markerRe)];
  const trimmed = text.trim();
  if (matches.length === 0) return trimmed ? [trimmed] : [];

  const items: string[] = [];
  const leading = text.slice(0, matches[0].index).trim();
  if (leading) items.push(leading);
  for (let i = 0; i < matches.length; i++) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const item = text.slice(start, end).trim();
    if (item) items.push(item);
  }
  return items;
}

function normalizeAnchorKey(word: string): AnchorKey {
  const w = word.toLowerCase();
  if (w.startsWith('subj')) return 'subj';
  if (w.startsWith('ref')) return 'ref';
  if (w.startsWith('encl')) return 'encl';
  return w as AnchorKey;
}

function isDateLike(s: string): boolean {
  return (
    /^\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4}$/.test(s) ||
    /^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}$/.test(s) ||
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(s) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)
  );
}

function dateConfidence(navalDate: string): Confidence {
  return /^\d{1,2}\s+[A-Za-z]{3}\s+\d{2}$/.test(navalDate) ? 'high' : 'low';
}

function isNameLine(s: string): boolean {
  return s.length <= 40 && !/\d/.test(s) && NAME_LINE_RE.test(s) && !SERVICE_LINE_RE.test(s);
}

export function parseCorrespondence(text: ExtractedText, documentType: string = 'basic'): ExtractionResult {
  const lines = text.lines.map(l => l.trim());
  const claimed = new Array<boolean>(lines.length).fill(false);
  const fields: ExtractedFieldMap = {};
  const vias: string[] = [];
  const references: string[] = [];
  const enclosures: string[] = [];
  const copyTos: string[] = [];
  const distList: string[] = [];
  const paragraphs: ParagraphData[] = [];
  const warnings: string[] = [...text.warnings];

  const claim = (i: number) => { claimed[i] = true; };

  const setField = (name: ExtractedFieldName, value: string, confidence: Confidence, sourceLines: number[]) => {
    if (fields[name]) {
      warnings.push(`Duplicate "${name}" value found near line ${sourceLines[0] + 1}; keeping the first one.`);
      return;
    }
    fields[name] = { value, confidence, sourceLines };
  };

  // --- Locate the regions ---------------------------------------------------
  const anchorIdx = lines.findIndex(l => ANCHOR_RE.test(l));
  const bodyIdx = lines.findIndex(l => LEVEL1_RE.test(l));
  let headerEnd: number;
  if (anchorIdx === -1 && bodyIdx === -1) {
    headerEnd = lines.length;
    if (lines.some(l => l !== '')) {
      warnings.push('Could not find From/To/Subj labels or numbered paragraphs in this document.');
    }
  } else if (anchorIdx === -1) {
    headerEnd = bodyIdx;
  } else if (bodyIdx === -1) {
    headerEnd = anchorIdx;
  } else {
    headerEnd = Math.min(anchorIdx, bodyIdx);
  }

  // --- Header / letterhead block ---------------------------------------------
  let ssicIdx = -1;
  let expectAddress = 0;
  let addressBuffer: { value: string; idx: number }[] = [];
  // The service line ("UNITED STATES MARINE CORPS") maps to headerType, not
  // a field — the app renders it from headerType. The letterhead lines after
  // it are buffered and mapped by count once the block ends: unit name
  // (line1), street (line2), city/state/zip (line3); four lines mean the
  // second is the optional unit sub-name (line1b). The sub-name mapping is a
  // guess (could be a four-line address), so it is flagged low confidence.
  const flushAddress = () => {
    if (addressBuffer.length === 0) return;
    const names: ExtractedFieldName[] =
      addressBuffer.length >= 4 ? ['line1', 'line1b', 'line2', 'line3'] : ['line1', 'line2', 'line3'];
    addressBuffer.forEach((entry, n) => {
      const name = names[n];
      if (!name) return;
      setField(name, entry.value.toUpperCase(), name === 'line1b' ? 'low' : 'high', [entry.idx]);
    });
    addressBuffer = [];
  };
  for (let i = 0; i < headerEnd; i++) {
    const s = lines[i];
    if (!s) { expectAddress = 0; flushAddress(); continue; }

    const combined = s.match(COMBINED_HEADER_RE);
    if (combined && !fields.ssic) {
      setField('ssic', combined[1], validateSSIC(combined[1]).isValid ? 'high' : 'low', [i]);
      setField('originatorCode', combined[2], 'high', [i]);
      const navalDate = parseAndFormatDate(combined[3]);
      setField('date', navalDate, dateConfidence(navalDate), [i]);
      ssicIdx = i;
      expectAddress = 0;
      flushAddress();
      claim(i);
      continue;
    }
    if (MEMO_HEADING_RE.test(s)) { expectAddress = 0; flushAddress(); claim(i); continue; }
    if (IN_REPLY_RE.test(s)) { claim(i); continue; }
    if (SERVICE_LINE_RE.test(s)) {
      if (!fields.headerType) {
        const headerType = /MARINE CORPS/i.test(s) ? 'USMC' : /LOGISTICS/i.test(s) ? 'DLA' : 'DON';
        setField('headerType', headerType, 'high', [i]);
        expectAddress = 4;
      }
      // A repeated service line (some exports carry it in both the page
      // header and the body) is claimed but never buffered as an address.
      claim(i);
      continue;
    }
    const ssicMatch = s.match(STANDALONE_SSIC_RE);
    if (ssicMatch && !fields.ssic) {
      const value = ssicMatch[1] + ssicMatch[2];
      setField('ssic', value, validateSSIC(value).isValid ? 'high' : 'low', [i]);
      ssicIdx = i;
      expectAddress = 0;
      flushAddress();
      claim(i);
      continue;
    }
    if (isDateLike(s) && !fields.date) {
      const navalDate = parseAndFormatDate(s);
      setField('date', navalDate, dateConfidence(navalDate), [i]);
      expectAddress = 0;
      flushAddress();
      claim(i);
      continue;
    }
    // A short code-shaped line after two buffered lines is an originator
    // code, not a third letterhead line — let it fall through.
    const looksLikeOriginator =
      ORIGINATOR_RE.test(s) && s.length <= 8 && !fields.originatorCode;
    if (expectAddress > 0 && !(looksLikeOriginator && addressBuffer.length >= 2)) {
      addressBuffer.push({ value: s, idx: i });
      expectAddress--;
      claim(i);
      continue;
    }
    if (looksLikeOriginator) {
      setField('originatorCode', s, ssicIdx !== -1 && i > ssicIdx ? 'high' : 'low', [i]);
      claim(i);
      continue;
    }
  }
  flushAddress();
  // Fallback: SSIC embedded in a line with other text. Guarded against
  // numbers that are part of a larger token — ZIP+4 codes (96602-8410),
  // decimals (5215.1K) — since a bare 4-5 digit number is all the format
  // guarantees; the match is still flagged low for review either way.
  if (!fields.ssic) {
    for (let i = 0; i < headerEnd; i++) {
      if (claimed[i] || !lines[i]) continue;
      const embedded = lines[i].match(/(?<![\d.-])(\d{4,5})(?![\d.-])/);
      if (embedded) {
        setField('ssic', embedded[1], 'low', [i]);
        break;
      }
    }
  }

  // --- Anchors, body, and closing (single pass state machine) -----------------
  type State = 'anchors' | 'body' | 'closing';
  let state: State = anchorIdx !== -1 && headerEnd === anchorIdx ? 'anchors' : 'body';
  let openAnchor: OpenAnchor | null = null;
  let currentParagraph: ParagraphData | null = null;
  let nextParagraphId = 1;
  let prevBlank = true;
  let awaitingDelegation = false;
  let activeClosingList: string[] | null = null;

  const flushAnchor = () => {
    if (!openAnchor) return;
    const { key, parts, sourceLines } = openAnchor;
    const joined = parts.reduce(joinLine, '').trim();
    openAnchor = null;
    if (!joined) return;
    switch (key) {
      case 'from':
        setField('from', joined, validateFromTo(joined).isValid ? 'high' : 'low', sourceLines);
        break;
      case 'to':
        setField('to', joined, validateFromTo(joined).isValid ? 'high' : 'low', sourceLines);
        break;
      case 'subj':
        setField('subj', joined, validateSubject(joined).isValid ? 'high' : 'low', sourceLines);
        break;
      case 'via':
        vias.push(...splitMarkedItems(joined, /\((\d{1,2})\)/g));
        break;
      case 'ref':
        references.push(...splitMarkedItems(joined, /\(([a-z]{1,2})\)/g));
        break;
      case 'encl':
        enclosures.push(...splitMarkedItems(joined, /\((\d{1,2})\)/g));
        break;
    }
  };

  const startParagraph = (level: number, content: string): ParagraphData => {
    const paragraph: ParagraphData = { id: nextParagraphId++, level, content };
    paragraphs.push(paragraph);
    return paragraph;
  };

  for (let i = headerEnd; i < lines.length; i++) {
    const s = lines[i];
    if (!s) {
      prevBlank = true;
      activeClosingList = null;
      continue;
    }

    if (state === 'anchors') {
      const anchorMatch = s.match(ANCHOR_RE);
      if (anchorMatch) {
        flushAnchor();
        openAnchor = {
          key: normalizeAnchorKey(anchorMatch[1]),
          parts: anchorMatch[2] ? [anchorMatch[2]] : [],
          sourceLines: [i],
        };
        claim(i);
        prevBlank = false;
        continue;
      }
      if (MEMO_HEADING_RE.test(s)) { claim(i); prevBlank = false; continue; }
      if (LEVEL1_RE.test(s)) {
        flushAnchor();
        state = 'body';
        // fall through to body handling below
      } else if (openAnchor && !prevBlank) {
        openAnchor.parts.push(s);
        openAnchor.sourceLines.push(i);
        claim(i);
        prevBlank = false;
        continue;
      } else if (prevBlank) {
        // Blank-separated unlabeled text after the anchors: the body has
        // started without a paragraph number.
        flushAnchor();
        state = 'body';
      } else {
        prevBlank = false;
        continue;
      }
    }

    if (state === 'body') {
      const closingMatch = s.match(CLOSING_ANCHOR_RE);
      if (closingMatch) {
        currentParagraph = null;
        state = 'closing';
        // fall through to closing handling below
      } else if (prevBlank && isNameLine(s)) {
        currentParagraph = null;
        setField('sig', s, 'high', [i]);
        awaitingDelegation = true;
        claim(i);
        state = 'closing';
        prevBlank = false;
        continue;
      } else {
        const markerLevels: [RegExp, number][] = [
          [LEVEL1_RE, 1],
          [LEVEL2_RE, 2],
          [LEVEL3_RE, 3],
          [LEVEL4_RE, 4],
        ];
        let marker: { level: number; content: string } | null = null;
        for (const [re, level] of markerLevels) {
          const m = re.exec(s);
          if (m) { marker = { level, content: m[2] }; break; }
        }
        if (marker) {
          currentParagraph = startParagraph(marker.level, marker.content);
        } else if (currentParagraph && !prevBlank) {
          currentParagraph.content = joinLine(currentParagraph.content, s);
        } else {
          currentParagraph = startParagraph(1, s);
          warnings.push(`Unnumbered text at line ${i + 1} was imported as a new paragraph.`);
        }
        claim(i);
        prevBlank = false;
        continue;
      }
    }

    if (state === 'closing') {
      const closingMatch = s.match(CLOSING_ANCHOR_RE);
      if (closingMatch) {
        activeClosingList = /^copy/i.test(closingMatch[1]) ? copyTos : distList;
        const remainder = closingMatch[2].trim();
        if (remainder) activeClosingList.push(remainder);
        claim(i);
      } else if (awaitingDelegation && DELEGATION_RE.test(s)) {
        setField('delegationText', s, 'high', [i]);
        claim(i);
      } else if (activeClosingList) {
        activeClosingList.push(s);
        claim(i);
      } else if (!fields.sig && isNameLine(s)) {
        setField('sig', s, 'high', [i]);
        awaitingDelegation = true;
        claim(i);
        prevBlank = false;
        continue; // skip the awaitingDelegation reset below
      }
      awaitingDelegation = false;
      prevBlank = false;
    }
  }
  flushAnchor();

  // --- Unmatched accounting ----------------------------------------------------
  const unmatchedText = lines
    .map((l, i) => (l && !claimed[i] ? l : null))
    .filter((l): l is string => l !== null);

  return {
    documentType,
    fields,
    vias,
    references,
    enclosures,
    copyTos,
    distList,
    paragraphs,
    unmatchedText,
    warnings,
  };
}
