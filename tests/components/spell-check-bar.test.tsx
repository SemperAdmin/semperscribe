/**
 * SpellCheckBar after D.6: it carries acronym guidance only, says so in
 * its label, stays out of the way when there is nothing to show, and keeps
 * the per-word dismiss.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpellCheckBar } from '@/components/ui/SpellCheckBar';
import type { SpellIssue } from '@/hooks/useSpellCheck';

afterEach(cleanup);

const issue = (word: string, suggestion: string): SpellIssue => ({
  word,
  index: 0,
  suggestion,
  type: 'acronym-suggestion',
});

describe('SpellCheckBar', () => {
  it('renders nothing when there are no issues', () => {
    const { container } = render(<SpellCheckBar issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels itself as acronym guidance and lists the acronyms', () => {
    render(
      <SpellCheckBar
        issues={[
          issue('MCO', 'Marine Corps Order (MCO)'),
          issue('TAD', 'Temporary Additional Duty (TAD)'),
        ]}
      />,
    );
    expect(screen.getByLabelText('Acronyms')).toBeTruthy();
    expect(screen.getByText('Acronyms')).toBeTruthy();
    expect(screen.getByText('MCO')).toBeTruthy();
    expect(screen.getByText('TAD')).toBeTruthy();
  });

  it('drops a dismissed acronym and hides once every one is dismissed', () => {
    const { container } = render(
      <SpellCheckBar issues={[issue('MCO', 'Marine Corps Order (MCO)')]} />,
    );
    fireEvent.click(screen.getByLabelText('Dismiss MCO'));
    expect(screen.queryByText('MCO')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
