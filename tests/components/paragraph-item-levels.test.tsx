/**
 * ParagraphItem: indent and outdent buttons and Alt+Shift+Arrow chords.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ParagraphItem } from '@/components/letter/ParagraphItem';

vi.mock('@/lib/reference-data', () => ({
  loadMilitaryWordSet: () => new Promise(() => {}),
  loadMilitaryDictionary: () => new Promise(() => {}),
  loadSsics: () => new Promise(() => {}),
  loadUnits: () => new Promise(() => {}),
  getLoadedUnits: () => [],
}));

afterEach(cleanup);

function renderItem(props: Partial<React.ComponentProps<typeof ParagraphItem>> = {}) {
  return render(
    <ParagraphItem
      paragraph={{ id: 5, level: 1, content: 'text' }}
      index={1}
      totalParagraphs={3}
      activeVoiceInput={null}
      citation="2."
      levelColor=""
      titleBadgeColor=""
      onUpdateContent={vi.fn()}
      onMoveUp={vi.fn()}
      onMoveDown={vi.fn()}
      onToggleVoice={vi.fn()}
      onAddParagraph={vi.fn()}
      onRemove={vi.fn()}
      onFocus={vi.fn()}
      isFocused={false}
      {...props}
    />,
  );
}

describe('ParagraphItem indent and outdent', () => {
  it('renders both buttons with target citations in the name', () => {
    const onIndent = vi.fn();
    renderItem({
      onIndent, onOutdent: vi.fn(),
      indentState: { ok: true }, outdentState: { ok: false, reason: 'Already at the top level' },
      nextCitations: { indent: '1c' },
    });
    const indent = screen.getByRole('button', { name: 'Indent paragraph 2 to 1c' });
    expect(indent).toBeEnabled();
    fireEvent.click(indent);
    expect(onIndent).toHaveBeenCalledWith(5);
  });

  it('disables a blocked button and gives the reason as its title', () => {
    renderItem({
      onIndent: vi.fn(), onOutdent: vi.fn(),
      indentState: { ok: true }, outdentState: { ok: false, reason: 'Already at the top level' },
    });
    const outdent = screen.getByRole('button', { name: /Outdent paragraph 2/ });
    expect(outdent).toBeDisabled();
    expect(outdent.getAttribute('title')).toContain('Already at the top level');
  });

  it('renders no level buttons when no handlers are given', () => {
    renderItem();
    expect(screen.queryByRole('button', { name: /Indent paragraph/ })).toBeNull();
  });

  it('fires handlers on Alt+Shift+Arrow from the read view', () => {
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    renderItem({ onIndent, onOutdent });
    const body = screen.getByRole('button', { name: 'Paragraph 2 body' });
    expect(fireEvent.keyDown(body, { key: 'ArrowRight', altKey: true, shiftKey: true })).toBe(false);
    fireEvent.keyDown(body, { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(onIndent).toHaveBeenCalledWith(5);
    expect(onOutdent).toHaveBeenCalledWith(5);
  });

  it('fires handlers from the textarea and ignores Tab and plain arrows', () => {
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    renderItem({ onIndent, onOutdent });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Paragraph 2 body' }), { key: 'Enter' });
    const area = screen.getByRole('textbox', { name: 'Paragraph 2 body' });
    fireEvent.keyDown(area, { key: 'ArrowRight' });
    fireEvent.keyDown(area, { key: 'Tab', shiftKey: true });
    expect(onIndent).not.toHaveBeenCalled();
    fireEvent.keyDown(area, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(onIndent).toHaveBeenCalledTimes(1);
    expect(onOutdent).not.toHaveBeenCalled();
  });
});
