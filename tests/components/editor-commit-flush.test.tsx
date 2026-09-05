/**
 * Both editors debounce their commit to document state while typing and
 * flush it on blur. Pins the fix for the smoke-test race (CI run #149):
 * an export issued within 500 ms of the last keystroke read stale state.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { z } from 'zod';
import { ParagraphItem } from '@/components/letter/ParagraphItem';
import { DynamicForm } from '@/components/ui/DynamicForm';
import type { DocumentTypeDefinition } from '@/lib/schemas';

vi.mock('@/lib/reference-data', () => ({
  loadMilitaryWordSet: () => new Promise(() => {}),
  loadMilitaryDictionary: () => new Promise(() => {}),
  loadSsics: () => new Promise(() => {}),
  loadUnits: () => new Promise(() => {}),
  getLoadedUnits: () => [],
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

function renderParagraph(onUpdateContent: (id: number, content: string) => void) {
  return render(
    <ParagraphItem
      paragraph={{ id: 1, level: 1, content: '' }}
      index={0}
      totalParagraphs={1}
      activeVoiceInput={null}
      citation="1."
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

describe('ParagraphItem commit', () => {
  it('debounces while typing and flushes on blur', () => {
    const onUpdateContent = vi.fn();
    renderParagraph(onUpdateContent);
    fireEvent.click(screen.getByText('Enter paragraph content...'));
    const textarea = screen.getByPlaceholderText('Enter paragraph content...');
    fireEvent.change(textarea, { target: { value: 'Request approval.' } });
    expect(onUpdateContent).not.toHaveBeenCalled();
    fireEvent.blur(textarea);
    expect(onUpdateContent).toHaveBeenCalledWith(1, 'Request approval.');
    act(() => { vi.advanceTimersByTime(600); });
    expect(onUpdateContent).toHaveBeenCalledTimes(1);
  });

  it('commits on the timer when the editor stays focused', () => {
    const onUpdateContent = vi.fn();
    renderParagraph(onUpdateContent);
    fireEvent.click(screen.getByText('Enter paragraph content...'));
    fireEvent.change(screen.getByPlaceholderText('Enter paragraph content...'), { target: { value: 'Typed.' } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onUpdateContent).toHaveBeenCalledWith(1, 'Typed.');
  });
});

const TINY: DocumentTypeDefinition = {
  id: 'tiny',
  name: 'Tiny',
  description: '',
  sections: [{
    id: 'main',
    title: 'Main',
    fields: [
      { name: 'subj', label: 'Subject', type: 'text' },
      { name: 'from', label: 'From', type: 'text' },
    ],
  }],
  schema: z.object({ documentType: z.string().optional(), subj: z.string().optional(), from: z.string().optional() }),
  features: {} as DocumentTypeDefinition['features'],
};

describe('DynamicForm commit', () => {
  it('debounces while typing and flushes when a field blurs', () => {
    const onSubmit = vi.fn();
    render(<DynamicForm documentType={TINY} onSubmit={onSubmit} defaultValues={{ documentType: 'tiny' }} />);
    const subject = screen.getByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'RANGE TIME' } });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.blur(subject);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ subj: 'RANGE TIME' });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('commits on the timer when focus stays in the field', () => {
    const onSubmit = vi.fn();
    render(<DynamicForm documentType={TINY} onSubmit={onSubmit} defaultValues={{ documentType: 'tiny' }} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'CO' } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ from: 'CO' });
  });
});
