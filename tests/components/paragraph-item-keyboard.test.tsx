/**
 * D.2 (UX_POLICY_PLAN_2026-09) - the paragraph body is operable by
 * keyboard, WCAG 2.1.1 Level A.
 *
 * Before this the body was a plain div with an onClick handler: no
 * textarea existed in the DOM until a mouse click landed on it, and the
 * app's primary input was unreachable by Tab. The read view stays, so
 * the rendered bold, italic and underline stay with it, and it is now a
 * real control which takes focus, opens on Enter or Space, and names
 * itself after the paragraph it holds.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ParagraphItem } from '@/components/letter/ParagraphItem';

vi.mock('@/lib/reference-data', () => ({
  loadMilitaryWordSet: () => new Promise(() => {}),
  loadMilitaryDictionary: () => new Promise(() => {}),
  loadSsics: () => new Promise(() => {}),
  loadUnits: () => new Promise(() => {}),
  getLoadedUnits: () => [],
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

const TABBABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Moves focus to the next tabbable element in document order. */
function pressTab() {
  const stops = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE));
  const current = stops.indexOf(document.activeElement as HTMLElement);
  (stops[current + 1] ?? stops[0])?.focus();
}

/** Tabs until the element takes focus, bounded. Returns the stops used. */
function tabTo(target: HTMLElement, limit = 40): number {
  for (let stops = 1; stops <= limit; stops++) {
    pressTab();
    if (document.activeElement === target) return stops;
  }
  return -1;
}

function renderParagraph(
  onUpdateContent: (id: number, content: string) => void = vi.fn(),
  overrides: { citation?: string; index?: number } = {},
) {
  return render(
    <ParagraphItem
      paragraph={{ id: 1, level: 1, content: '' }}
      index={overrides.index ?? 0}
      totalParagraphs={3}
      activeVoiceInput={null}
      citation={overrides.citation ?? '1.'}
      levelColor=""
      titleBadgeColor=""
      onUpdateContent={onUpdateContent}
      onMoveUp={vi.fn()}
      onMoveDown={vi.fn()}
      onToggleVoice={vi.fn()}
      onAddParagraph={vi.fn()}
      onRemove={vi.fn()}
      onFocus={vi.fn()}
      isFocused={false}
    />,
  );
}

describe('ParagraphItem keyboard access', () => {
  it('reaches the body with Tab and takes text with no mouse click', () => {
    const onUpdateContent = vi.fn();
    renderParagraph(onUpdateContent);

    const body = screen.getByRole('button', { name: 'Paragraph 1 body' });
    expect(tabTo(body)).toBeGreaterThan(0);

    fireEvent.keyDown(body, { key: 'Enter' });
    act(() => { vi.advanceTimersByTime(0); });

    const textarea = screen.getByPlaceholderText('Enter paragraph content...');
    expect(document.activeElement).toBe(textarea);

    fireEvent.change(textarea, { target: { value: 'Typed without a mouse.' } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onUpdateContent).toHaveBeenCalledWith(1, 'Typed without a mouse.');
  });

  it('opens on Space as well as Enter', () => {
    renderParagraph();
    const body = screen.getByRole('button', { name: 'Paragraph 1 body' });
    body.focus();
    fireEvent.keyDown(body, { key: ' ' });
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByPlaceholderText('Enter paragraph content...')).toBeInTheDocument();
  });

  it('names the textarea after the paragraph citation', () => {
    renderParagraph(vi.fn(), { citation: '2.a.' });
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 2.a body' }));
    expect(screen.getByPlaceholderText('Enter paragraph content...'))
      .toHaveAttribute('aria-label', 'Paragraph 2.a body');
  });

  it('names the body by its position when the citation is a bullet', () => {
    renderParagraph(vi.fn(), { citation: '•', index: 2 });
    expect(screen.getByRole('button', { name: 'Paragraph 3 body' })).toBeInTheDocument();
  });

  it('leaves the body on Escape, committing the text', () => {
    const onUpdateContent = vi.fn();
    renderParagraph(onUpdateContent);
    const body = screen.getByRole('button', { name: 'Paragraph 1 body' });
    fireEvent.keyDown(body, { key: 'Enter' });
    act(() => { vi.advanceTimersByTime(0); });

    const textarea = screen.getByPlaceholderText('Enter paragraph content...');
    fireEvent.change(textarea, { target: { value: 'Request approval.' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    fireEvent.blur(textarea);
    act(() => { vi.advanceTimersByTime(0); });

    expect(onUpdateContent).toHaveBeenCalledWith(1, 'Request approval.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Paragraph 1 body' }));
  });
});
