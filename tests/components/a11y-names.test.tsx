/**
 * Accessible names (P8-3, P8-4, P8-5, P8-8 of the 2026-09 remediation).
 *
 * axe measured every Radix SelectTrigger rendered without an id plus a
 * Label htmlFor (or an aria-label) as having an EMPTY accessible name:
 * the trigger shows "Marine Corps" and a screen reader announces
 * nothing. DynamicForm's checkbox put the form item id on a wrapper div,
 * so its FormLabel pointed at a div and the checkbox had no name. The
 * command palette dialog had no title, put role="separator" inside its
 * role="listbox", and dropped focus to body on Escape.
 *
 * The full sweep across the editors is measured by tests/e2e/axe.spec.ts
 * against the built export. This file pins the wiring in jsdom for the
 * components the audit named, so the next label without an htmlFor goes
 * red here before it reaches the axe gate.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, type DocumentTypeDefinition } from '@/lib/schemas';
import { CommandPalette } from '@/components/CommandPalette';
import { AccusedRankSection } from '@/components/letter/navmc10132/AccusedRankSection';
import { NjpAuthoritySection } from '@/components/letter/navmc10132/NjpAuthoritySection';
import { VictimsSection } from '@/components/letter/navmc10132/VictimsSection';
import { SectionCard } from '@/components/letter/Navmc10132Sections';
import { EndorsementDetailsSection } from '@/components/document/EndorsementDetailsSection';
import type { FormData } from '@/types';

afterEach(cleanup);

function navmcForm(extra: Record<string, unknown> = {}): FormData {
  return { documentType: 'navmc10132', ...extra } as unknown as FormData;
}

/** The trigger a label names must be Radix's combobox button, not a div. */
function expectComboboxNamed(name: string | RegExp) {
  const el = screen.getByLabelText(name);
  expect(el.tagName).toBe('BUTTON');
  expect(el).toHaveAttribute('role', 'combobox');
  return el;
}

describe('P8-3: Select triggers carry the name of their visible label', () => {
  it('AccusedRankSection: Service, Rank and Pay grade', () => {
    render(<AccusedRankSection formData={navmcForm()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    expectComboboxNamed('Service');
    expectComboboxNamed('Rank');
    expectComboboxNamed('Pay grade');
  });

  it('NjpAuthoritySection: Service, Rank and Pay grade, plus the item 8 and 8B inputs', () => {
    render(<NjpAuthoritySection formData={navmcForm()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    expectComboboxNamed('Service');
    expectComboboxNamed('Rank');
    expectComboboxNamed('Pay grade');
    expect(screen.getByLabelText(/Item 8 - name/).tagName).toBe('INPUT');
    expect(screen.getByLabelText(/Item 8B - EDIPI/).tagName).toBe('INPUT');
  });

  it('VictimsSection: the four demographic selects of row A', () => {
    render(<VictimsSection formData={navmcForm()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    for (const name of ['Status', 'Sex', 'Race', 'Ethnicity']) expectComboboxNamed(name);
  });

  it('EndorsementDetailsSection: level, starting reference letter, and the two number inputs', () => {
    function Harness() {
      const [formData, setFormData] = useState<FormData>({
        documentType: 'endorsement',
        endorsementLevel: 'FIRST',
        startingReferenceLevel: 'c',
        startingEnclosureNumber: '2',
        previousPackagePageCount: 1,
      } as FormData);
      return <EndorsementDetailsSection formData={formData} setFormData={setFormData} />;
    }
    render(<Harness />);
    expectComboboxNamed(/Endorsement Level/);
    expectComboboxNamed('Start References At Letter');
    expect(screen.getByLabelText('Last Page # of Previous Document').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Start Enclosures At Number').tagName).toBe('INPUT');
  });
});

describe('P8-5: DynamicForm checkbox', () => {
  /** The MCO definition carries checkbox fields (4-Digit Numbering and
   *  the structural-page toggles). */
  function checkboxDefinition(): DocumentTypeDefinition {
    const def = DOCUMENT_TYPES['mco'];
    const sections = def.sections
      .map((s) => ({ ...s, fields: s.fields.filter((f) => f.type === 'checkbox') }))
      .filter((s) => s.fields.length > 0);
    if (sections.length === 0) throw new Error('mco definition has no checkbox fields');
    return { ...def, sections };
  }

  it('is named by its label, and the label click toggles it', () => {
    const onSubmit = vi.fn();
    render(<DynamicForm documentType={checkboxDefinition()} onSubmit={onSubmit} defaultValues={{}} />);
    const box = screen.getByRole('checkbox', { name: /4-Digit Numbering/ });
    // The id lands on the checkbox itself, not a wrapper div.
    expect(box.tagName).toBe('BUTTON');
    expect(box.id).toMatch(/-form-item$/);
    expect(box).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByText('4-Digit Numbering'));
    expect(box).toHaveAttribute('aria-checked', 'true');
  });
});

describe('P8-8: command palette dialog', () => {
  // cmdk scrolls the selected item into view on mount; jsdom has no
  // scrollIntoView.
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  });

  function palette(open: boolean, onOpenChange: (open: boolean) => void = vi.fn()) {
    return (
      <CommandPalette
        open={open}
        onOpenChange={onOpenChange}
        onSelectType={vi.fn()}
        onExportPdf={vi.fn()}
        onExportDocx={vi.fn()}
        onSave={vi.fn()}
        onOpenLibrary={vi.fn()}
        onShareLink={vi.fn()}
        onFindReplace={vi.fn()}
        onCompliance={vi.fn()}
        onGuide={vi.fn()}
        onSettings={vi.fn()}
        onClearForm={vi.fn()}
        hasDocument
      />
    );
  }

  it('has an accessible name and no separator inside the listbox', () => {
    render(palette(true));
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    const listbox = screen.getByRole('listbox');
    expect(listbox.querySelector('[role="separator"]')).toBeNull();
    // The visual rule is still drawn, as a presentational element.
    expect(listbox.querySelectorAll('[cmdk-separator]').length).toBeGreaterThan(0);
  });

  it('returns focus to the element focused before it opened', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Commands</button>
          {palette(open, setOpen)}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Commands' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
