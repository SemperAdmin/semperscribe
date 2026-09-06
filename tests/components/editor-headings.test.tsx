/**
 * D.8 - the form section headers are heading elements.
 *
 * The UX audit measured "Form section headings: 0 of 9 are heading
 * elements": Unit Information, Header Information, Via, References,
 * Enclosures, Body Paragraphs, Closing Block, Distribution and Copy To
 * were all plain divs, so a screen-reader user had no way to move
 * through the editor by heading. Each is now an h3 sitting under the
 * document-type h2 the editor renders above the form.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { UnitInfoSection } from '@/components/letter/UnitInfoSection';
import { ViaSection } from '@/components/letter/ViaSection';
import { ReferencesSection } from '@/components/letter/ReferencesSection';
import { EnclosuresSection } from '@/components/letter/EnclosuresSection';
import { ParagraphSection } from '@/components/letter/ParagraphSection';
import { ClosingBlockSection } from '@/components/letter/ClosingBlockSection';
import { CopyToSection } from '@/components/letter/CopyToSection';
import { DistributionSection } from '@/components/letter/DistributionSection';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { getClassification } from '@/lib/classification';
import type { FormData } from '@/types';

afterEach(cleanup);

const formData = { documentType: 'basic', ssic: '', from: '', to: '', subj: '' } as unknown as FormData;

/** Asserts a heading with this name exists at level 3. */
function expectSectionHeading(name: string | RegExp) {
  expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
}

describe('editor section headings', () => {
  it('renders the dynamic form section title as a heading', () => {
    render(
      <DynamicForm
        documentType={DOCUMENT_TYPES['basic']}
        onSubmit={vi.fn()}
        defaultValues={{ documentType: 'basic' }}
      />,
    );
    expectSectionHeading('Header Information');
  });

  it('renders Unit Information as a heading', () => {
    render(
      <UnitInfoSection
        formData={formData}
        setFormData={vi.fn()}
        setCurrentUnitCode={vi.fn()}
        setCurrentUnitName={vi.fn()}
      />,
    );
    expectSectionHeading(/Unit Information/);
  });

  it('renders Via as a heading', () => {
    render(<ViaSection vias={[]} setVias={vi.fn()} />);
    expectSectionHeading(/Via/);
  });

  it('renders References as a heading', () => {
    render(
      <ReferencesSection
        references={[]}
        setReferences={vi.fn()}
        formData={formData}
        setFormData={vi.fn()}
      />,
    );
    expectSectionHeading(/References/);
  });

  it('renders Enclosures as a heading', () => {
    render(
      <EnclosuresSection
        rows={[]}
        onAddRow={vi.fn()}
        onRemoveRow={vi.fn()}
        onUpdateTitle={vi.fn()}
        onMoveRow={vi.fn()}
        onClearRows={vi.fn()}
        files={new Map()}
        onBindFile={vi.fn()}
        onUnbindFile={vi.fn()}
        coverPages={false}
        onCoverPagesChange={vi.fn()}
        formData={formData}
        setFormData={vi.fn()}
      />,
    );
    expectSectionHeading(/Enclosures/);
  });

  it('renders Body Paragraphs as a heading', () => {
    render(
      <ParagraphSection
        paragraphs={[{ id: 1, level: 1, content: '', acronymError: '' }]}
        documentType="basic"
        activeVoiceInput={null}
        validateParagraphNumbering={() => []}
        getUiCitation={() => '1.'}
        moveParagraphUp={vi.fn()}
        moveParagraphDown={vi.fn()}
        updateParagraphContent={vi.fn()}
        toggleVoiceInput={vi.fn()}
        addParagraph={vi.fn()}
        removeParagraph={vi.fn()}
        classification={getClassification(formData)}
        onUpdateMarking={vi.fn()}
      />,
    );
    expectSectionHeading(/Body Paragraphs/);
  });

  it('renders Closing Block as a heading', () => {
    render(
      <ClosingBlockSection
        formData={formData}
        setFormData={vi.fn()}
        copyTos={[]}
        setCopyTos={vi.fn()}
        distList={[]}
        setDistList={vi.fn()}
      />,
    );
    expectSectionHeading(/Closing Block/);
  });

  it('renders Copy To as a heading', () => {
    render(<CopyToSection copyTos={[]} setCopyTos={vi.fn()} />);
    expectSectionHeading(/Copy To/);
  });

  it('renders Distribution as a heading', () => {
    render(<DistributionSection distribution={{ type: 'standard' }} onUpdateDistribution={vi.fn()} />);
    expectSectionHeading(/Distribution/);
  });
});
