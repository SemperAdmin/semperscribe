import React from 'react';
import { Text } from '@react-pdf/renderer';

interface PdfStyle {
  fontWeight?: 'bold';
  fontStyle?: 'italic';
  textDecoration?: 'underline';
  [key: `@media${string}`]: never;
}

/**
 * Parses markdown-like formatting into React-PDF Text components.
 * Supports nested formatting: ***bold italic***, **<u>bold underline</u>**, *<u>italic underline</u>*, etc.
 * Uses style accumulation (not nesting) because react-pdf Text does not inherit parent styles.
 */
export function parseFormattedText(text: string, parentStyle: PdfStyle = {}): React.ReactNode[] {
  if (!text) return [];

  const parts = splitInlineMarkup(text);

  // Explicit return annotation: every branch returns an array, but
  // inference widens to a union flatMap's overloads reject. Latent
  // pre-existing error surfaced 2026-07-15 during Phase 1 verification.
  return parts.flatMap((part, index): React.ReactNode[] => {
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return parseFormattedText(part.slice(3, -3), { ...parentStyle, fontWeight: 'bold', fontStyle: 'italic' });
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return parseFormattedText(part.slice(2, -2), { ...parentStyle, fontWeight: 'bold' });
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return parseFormattedText(part.slice(1, -1), { ...parentStyle, fontStyle: 'italic' });
    }
    if (part.startsWith('<u>') && part.endsWith('</u>') && part.length >= 7) {
      return parseFormattedText(part.slice(3, -4), { ...parentStyle, textDecoration: 'underline' });
    }
    // Leaf node: apply all accumulated styles
    if (!part) return [];
    if (Object.keys(parentStyle).length > 0) {
      return [<Text key={index} style={parentStyle}>{part}</Text>];
    }
    return [part];
  });
}

function isLineTerminator(code: number): boolean {
  return code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029;
}

/**
 * For every index i, the nearest j >= i at which `marker` starts with
 * no line terminator in [i, j), or -1. One backward pass per marker,
 * so the tokenizer never rescans the same tail twice.
 */
function nextOccurrences(text: string, marker: string): Int32Array {
  const n = text.length;
  const next = new Int32Array(n + 1).fill(-1);
  for (let i = n - 1; i >= 0; i--) {
    if (isLineTerminator(text.charCodeAt(i))) continue; // stays -1
    next[i] = text.startsWith(marker, i) ? i : next[i + 1];
  }
  return next;
}

/**
 * Splits text on the four inline markers exactly as the former
 * `text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>)/g)` did:
 * at each position the alternatives are tried in that order, each
 * closes at the nearest matching marker on the same line (`.` never
 * crossed a line break), an opener with no closer falls through to the
 * next alternative, and the plain text between tokens is kept - empty
 * strings included - so the returned array is index-for-index the old
 * split result. The regex was quadratic on repeated unclosed openers:
 * 240 KB of "<u>a" took 6.6 s (P4-3). This is one linear pass.
 */
export function splitInlineMarkup(text: string): string[] {
  // Nothing to tokenize: the common case for every recursive leaf.
  if (!text.includes('*') && !text.includes('<u>')) return [text];
  const n = text.length;
  const next3 = nextOccurrences(text, '***');
  const next2 = nextOccurrences(text, '**');
  const next1 = nextOccurrences(text, '*');
  const nextU = nextOccurrences(text, '</u>');
  // A lookup at an index past the end reads as "no closer".
  const at = (arr: Int32Array, i: number) => (i <= n ? arr[i] : -1);

  const parts: string[] = [];
  let segStart = 0;
  let i = 0;
  while (i < n) {
    const c = text.charCodeAt(i);
    let end = -1;
    if (c === 0x2a /* * */) {
      const star2 = text.charCodeAt(i + 1) === 0x2a;
      const star3 = star2 && text.charCodeAt(i + 2) === 0x2a;
      if (star3) {
        const j = at(next3, i + 3);
        if (j >= 0) end = j + 3;
      }
      if (end < 0 && star2) {
        const j = at(next2, i + 2);
        if (j >= 0) end = j + 2;
      }
      if (end < 0) {
        const j = at(next1, i + 1);
        if (j >= 0) end = j + 1;
      }
    } else if (c === 0x3c /* < */ && text.startsWith('<u>', i)) {
      const j = at(nextU, i + 3);
      if (j >= 0) end = j + 4;
    }
    if (end < 0) {
      i++;
      continue;
    }
    parts.push(text.slice(segStart, i), text.slice(i, end));
    i = end;
    segStart = end;
  }
  parts.push(text.slice(segStart));
  return parts;
}
