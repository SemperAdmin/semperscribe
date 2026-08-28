import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemarksSection } from '@/components/letter/navmc10132/RemarksSection';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { item21LineCapacity } from '@/lib/navmc10132-item21-continuation';
import { FormData } from '@/types';

/**
 * The item 21 continuation panel.
 *
 * WHY THIS IS A COMPONENT TEST AND NOT ONLY A LIBRARY ONE. paginateItem21
 * ends the widget on "Continued on the attached item 21 supplemental page".
 * If the panel that produces that page fails to appear, the export points a
 * reader at a sheet nobody can generate, which is worse than the clipping it
 * replaced. The field value and the button ship together or neither ships,
 * so the pairing is what gets asserted.
 */

function StubSectionCard({
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function doc(remarksFreeText: string): FormData {
  return {
    ...(createEmptyNavmc10132Data() as unknown as FormData),
    documentType: 'navmc10132',
    accusedName: 'Dog, Devil D.',
    accusedEdipi: '1234567890',
    remarksFreeText,
  } as FormData;
}

function renderAt(lineCount: number) {
  const text = Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`).join('\n');
  return render(
    <RemarksSection
      formData={doc(text)}
      setFormData={vi.fn()}
      SectionCard={StubSectionCard}
      stage={3}
    />,
  );
}

describe('the continuation panel appears exactly when item 21 overflows', () => {
  const capacity = item21LineCapacity();

  it('stays hidden while item 21 fits', () => {
    renderAt(5);
    expect(screen.queryByText(/Item 21 runs past the box/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /item 21 continuation/i }),
    ).not.toBeInTheDocument();
  });

  it('offers the sheet once it does not', () => {
    renderAt(capacity + 20);
    expect(screen.getByText(/Item 21 runs past the box/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /item 21 continuation/i }),
    ).toBeInTheDocument();
  });

  // The count on screen has to be the real one. A panel reporting a wrong
  // number is a panel a clerk stops believing.
  it('reports how many lines did not fit', () => {
    renderAt(capacity + 20);
    // capacity - 1 lines stay on the form, the pointer takes the last line,
    // so the overflow is everything from line `capacity` onward, plus the
    // one displaced by the pointer.
    expect(screen.getByText(/21 lines do not fit/)).toBeInTheDocument();
  });

  it('names the widget capacity it is working against', () => {
    renderAt(capacity + 20);
    expect(
      screen.getByText(new RegExp(`renders ${capacity} lines`)),
    ).toBeInTheDocument();
  });
});
