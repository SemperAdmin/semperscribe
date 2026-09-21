// tests/volume/block-editor.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockEditor } from '@/components/volume/BlockEditor';
import type { Block } from '@/lib/schemas/volume-schema';

// Finding 2: a Block with 2+ runs used to collapse to `block.runs[0]` alone
// in the textarea, and the first keystroke wrote back a single-run array,
// permanently destroying every other run's text/flags/href.
describe('BlockEditor multi-run safety (finding 2)', () => {
  it('shows the text of BOTH runs in the textarea for a 2-run block', () => {
    const block: Block = {
      runs: [
        { text: 'See ' },
        { text: 'this reference', link: true, href: 'https://example.mil', changed: true },
      ],
    };
    const onChange = vi.fn();
    render(<BlockEditor block={block} onChange={onChange} label="test block" />);
    const textarea = screen.getByLabelText('test block') as HTMLTextAreaElement;
    expect(textarea.value).toBe('See this reference');
  });

  it('renders the multi-run textarea read-only and never calls onChange on render', () => {
    const block: Block = {
      runs: [{ text: 'plain ' }, { text: 'linked', link: true, href: 'https://example.mil' }],
    };
    const onChange = vi.fn();
    render(<BlockEditor block={block} onChange={onChange} label="test block" />);
    const textarea = screen.getByLabelText('test block') as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/multi-run block/i)).toBeTruthy();
  });

  it('does not render the flag-toggle controls for a multi-run block', () => {
    const block: Block = {
      runs: [{ text: 'a' }, { text: 'b', changed: true }],
    };
    render(<BlockEditor block={block} onChange={vi.fn()} label="test block" />);
    expect(screen.queryByRole('button', { name: /mark changed/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /insert link/i })).toBeNull();
  });

  it('still edits normally for a single-run block (unaffected by the fix)', () => {
    const block: Block = { runs: [{ text: 'plain text' }] };
    render(<BlockEditor block={block} onChange={vi.fn()} label="test block" />);
    const textarea = screen.getByLabelText('test block') as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(false);
    expect(textarea.value).toBe('plain text');
    expect(screen.getByRole('button', { name: /mark changed/i })).toBeTruthy();
  });
});
