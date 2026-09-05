/**
 * D.8 (UX audit finding 7, the brand-new join) - "Start from a filled
 * example".
 *
 * The audit recorded "No example or sample letter anywhere in the
 * first-run path. examples/ holds one .nldp that the UI never
 * references." The card now loads that shipped package through
 * handleLoadTemplateUrl, the same fetch-parse-import path the File menu
 * uses for a .nldp a drafter picks off disk.
 *
 * The harness below is the real hook wired to real state, with only the
 * network faked, and it reads the real file off disk: if the shipped
 * example stops loading into the editor, this fails.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { LandingPage, EXAMPLE_DOCUMENT_URL } from '@/components/layout/LandingPage';
import { useImportExport } from '@/hooks/useImportExport';
import { runLetterValidators } from '@/lib/letter-validators';
import { militaryDictionary } from '@/lib/military-dictionary';
import type { FormData, ParagraphData, ValidationState } from '@/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/**
 * Read fresh per call. The import path strips empty letterhead lines
 * out of the object it is handed, the way it does with a real fetch
 * response, so a shared fixture would arrive at the next test already
 * edited.
 */
function readExample(): any {
  return JSON.parse(readFileSync('public/examples/sample-training-schedule.nldp', 'utf8'));
}

describe('landing example card', () => {
  it('offers the card and calls the loader', () => {
    const onLoadExample = vi.fn();
    render(<LandingPage onSelectType={vi.fn()} onLoadExample={onLoadExample} />);
    fireEvent.click(screen.getByRole('button', { name: /Start from a filled example/ }));
    expect(onLoadExample).toHaveBeenCalledTimes(1);
  });

  it('omits the card when no loader is wired', () => {
    render(<LandingPage onSelectType={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Start from a filled example/ })).toBeNull();
  });

  it('points at the shipped package', () => {
    expect(EXAMPLE_DOCUMENT_URL).toBe('/examples/sample-training-schedule.nldp');
  });

  it('loads the example into the editor, subject and all', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      statusText: 'OK',
      json: async () => readExample(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Start from a filled example/ }));

    await waitFor(() => expect(screen.queryByTestId('subject')).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(EXAMPLE_DOCUMENT_URL);
    expect(screen.getByTestId('subject')).toHaveTextContent('SAMPLE TRAINING SCHEDULE - NOT FOR OFFICIAL USE');
    expect(screen.getByTestId('doctype')).toHaveTextContent('basic');
    expect(screen.getByTestId('paragraph-count')).toHaveTextContent('7');
  });

  it('ships a letter the validators pass, so the banner lands clear', () => {
    const { formData, vias, references, paragraphs, enclosures } = readExample().data;
    const issues = runLetterValidators(formData, vias, references, paragraphs, {
      enclosures,
      dictionary: militaryDictionary,
    });
    // The point of the card is a first run with nothing red on screen.
    // A drafter who opens the example and meets a compliance failure
    // learns the opposite of what it is there to teach.
    expect(issues.map(i => `${i.severity} ${i.id}`)).toEqual([]);
  });
});

/**
 * The landing page and the smallest slice of editor state which shows
 * whether the import landed. The import hook is the real one.
 */
function Harness() {
  const [formData, setFormData] = useState<FormData>({ documentType: '' } as FormData);
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>([]);
  const [vias, setVias] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [enclosures, setEnclosures] = useState<string[]>([]);
  const [copyTos, setCopyTos] = useState<string[]>([]);
  const [distList, setDistList] = useState<string[]>([]);
  const [, setFormKey] = useState(0);
  const [, setValidation] = useState<ValidationState>({} as ValidationState);

  const { handleLoadTemplateUrl } = useImportExport({
    formData, setFormData,
    paragraphs, setParagraphs,
    vias, setVias,
    references, setReferences,
    enclosures, setEnclosures,
    copyTos, setCopyTos,
    distList, setDistList,
    setFormKey, setValidation,
    savedLetters: [],
    toast: vi.fn(),
  });

  if (!formData.documentType) {
    return (
      <LandingPage
        onSelectType={vi.fn()}
        onLoadExample={() => { void handleLoadTemplateUrl(EXAMPLE_DOCUMENT_URL); }}
      />
    );
  }
  return (
    <div>
      <span data-testid="doctype">{formData.documentType}</span>
      <span data-testid="subject">{formData.subj}</span>
      <span data-testid="paragraph-count">{paragraphs.length}</span>
    </div>
  );
}
