import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ITypeAppendixEditor } from '@/components/itype/ITypeAppendixEditor';
import type { AppendixParagraph } from '@/lib/i-type/appendix-paragraphs';

afterEach(cleanup);

const list = (): AppendixParagraph[] => [
  { id: 1, level: 1, content: 'one' },
  { id: 2, level: 1, content: 'two' },
  { id: 3, level: 2, content: 'two-a' },
  { id: 4, level: 1, content: 'three', title: 'Purpose' },
];

describe('ITypeAppendixEditor indent/outdent', () => {
  it('indent moves the whole branch', () => {
    const onChange = vi.fn();
    render(<ITypeAppendixEditor paragraphs={list()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Indent paragraph 2.' }));
    expect(onChange.mock.calls[0][0].map((p: AppendixParagraph) => p.level)).toEqual([1, 2, 3, 1]);
  });
  it('blocks the first item, a level skip, and top-level outdent with reasons', () => {
    render(<ITypeAppendixEditor paragraphs={list()} onChange={vi.fn()} />);
    const first = screen.getByRole('button', { name: 'Indent paragraph 1.' });
    expect(first).toBeDisabled();
    expect(first.getAttribute('title')).toBe('No paragraph above to nest under');
    expect(screen.getByRole('button', { name: 'Indent paragraph a.' }).getAttribute('title'))
      .toBe('Already one level below the paragraph above');
    expect(screen.getAllByRole('button', { name: /^Outdent paragraph 1\.$/ })[0].getAttribute('title'))
      .toBe('Already at the top level');
  });
  it('blocks titled template paragraphs', () => {
    render(<ITypeAppendixEditor paragraphs={list()} onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Indent paragraph 3.' });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toBe('Required by the document template');
  });
  it('outdent moves the branch and announces; Alt+Shift+Arrow fires', () => {
    const onChange = vi.fn();
    render(<ITypeAppendixEditor paragraphs={list()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Outdent paragraph a.' }));
    expect(onChange.mock.calls[0][0][2].level).toBe(1);
    expect(screen.getByRole('status').textContent).toBe('Paragraph is now 3.');
    fireEvent.keyDown(screen.getAllByPlaceholderText('Enter paragraph content...')[1], { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
