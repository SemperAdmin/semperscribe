/**
 * parseFormattedText parity (P4-3).
 *
 * The fixture file holds the segment trees the pre-P4-3 regex splitter
 * produced for 43 inputs (balanced, nested, unbalanced, empty, and
 * repeated markers), captured on 2026-09-07 before the tokenizer was
 * replaced. The linear tokenizer must reproduce every one of them.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { parseFormattedText } from '@/lib/pdf-text-parser';
import fixtures from './fixtures/pdf-text-parser-segments.json';

function serialise(node: React.ReactNode): unknown {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(serialise);
  if (React.isValidElement(node)) {
    const props = node.props as { style?: unknown; children?: React.ReactNode };
    return { style: props.style, children: serialise(props.children) };
  }
  return node;
}

describe('parseFormattedText parity with the regex splitter', () => {
  it.each(fixtures.map((f) => [JSON.stringify(f.input), f] as const))(
    'input %s',
    (_label, fixture) => {
      expect(serialise(parseFormattedText(fixture.input))).toEqual(fixture.plain);
      expect(serialise(parseFormattedText(fixture.input, { fontWeight: 'bold' }))).toEqual(fixture.styled);
    },
  );

  it('accumulates styles through nesting', () => {
    const out = serialise(parseFormattedText('***<u>x</u>***'));
    expect(out).toEqual([
      { style: { fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline' }, children: 'x' },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseFormattedText('')).toEqual([]);
  });
});
