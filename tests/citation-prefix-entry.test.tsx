/**
 * Hand-typed citation prefixes are stripped where references and
 * enclosures enter state: handleImport (file, draft, template, share
 * link, Word/PDF import) and the input fields (on blur).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { renderHook, act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useImportExport } from '@/hooks/useImportExport';
import { ReferencesSection } from '@/components/letter/ReferencesSection';
import { EnclosuresSection } from '@/components/letter/EnclosuresSection';
import type { EnclosureRow } from '@/lib/enclosure-rows';
import type { FormData, ParagraphData, ValidationState } from '@/types';

afterEach(cleanup);

function useHarness() {
  const [formData, setFormData] = useState<FormData>({ documentType: 'basic' } as unknown as FormData);
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>([]);
  const [vias, setVias] = useState<string[]>(['']);
  const [references, setReferences] = useState<string[]>(['']);
  const [enclosures, setEnclosures] = useState<string[]>(['']);
  const [copyTos, setCopyTos] = useState<string[]>(['']);
  const [distList, setDistList] = useState<string[]>(['']);
  const [, setFormKey] = useState(0);
  const [, setValidation] = useState<ValidationState>({} as ValidationState);
  const [bindings] = useState(() => vi.fn());
  const api = useImportExport({
    formData, setFormData, paragraphs, setParagraphs, vias, setVias,
    references, setReferences, enclosures, setEnclosures, copyTos, setCopyTos,
    distList, setDistList, setFormKey, setValidation,
    savedLetters: [], toast: vi.fn(), onEnclosureBindings: bindings,
  } as never);
  return { api, references, enclosures, bindings };
}

describe('handleImport strips citation prefixes', () => {
  it('plain strings and NLDP {text} objects', () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.api.handleImport({
      formData: { documentType: 'basic' },
      references: ['(a) MCO 1553.3B', { text: 'Ref: (b) U.S. Navy Regulations, 1990', order: 2 }],
      enclosures: ['Encl (1) Unit SOP', '(2) Map'],
      paragraphs: [],
    }));
    expect(result.current.references).toEqual(['MCO 1553.3B', 'U.S. Navy Regulations, 1990']);
    expect(result.current.enclosures).toEqual(['Unit SOP', 'Map']);
  });

  it('enclosure binding titles', () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.api.handleImport({
      formData: { documentType: 'basic' }, paragraphs: [],
      enclosureBindings: [{ key: 'k1', title: 'Encl (1) Unit SOP', fileId: 'f1' }],
    }));
    expect(result.current.bindings).toHaveBeenCalledWith([{ key: 'k1', title: 'Unit SOP', fileId: 'f1' }]);
  });
});

const basic = { documentType: 'basic', startingReferenceLevel: 'a', startingEnclosureNumber: '1' } as unknown as FormData;

describe('input fields strip on blur, not on keystroke', () => {
  it('reference field', () => {
    function Host() {
      const [refs, setRefs] = useState<string[]>(['']);
      return <ReferencesSection references={refs} setReferences={setRefs} formData={basic} setFormData={vi.fn()} />;
    }
    render(<Host />);
    // Starts blank (section collapsed); open it, then type like a Marine.
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    const input = screen.getByRole('textbox', { name: 'Reference (a)' });
    fireEvent.change(input, { target: { value: '(a) MCO 1553.3B' } });
    expect(input).toHaveValue('(a) MCO 1553.3B');
    fireEvent.blur(input);
    expect(screen.getByRole('textbox', { name: 'Reference (a)' })).toHaveValue('MCO 1553.3B');
  });

  it('enclosure field', () => {
    const onUpdateTitle = vi.fn();
    const rows: EnclosureRow[] = [{ key: 'r1', title: 'Encl (1) Unit SOP' }];
    render(
      <EnclosuresSection
        rows={rows}
        onAddRow={vi.fn()} onRemoveRow={vi.fn()} onUpdateTitle={onUpdateTitle}
        onMoveRow={vi.fn()} onClearRows={vi.fn()}
        files={new Map()} onBindFile={vi.fn()} onUnbindFile={vi.fn()}
        coverPages={false} onCoverPagesChange={vi.fn()}
        formData={basic} setFormData={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Enclosure (1)' });
    fireEvent.blur(input);
    expect(onUpdateTitle).toHaveBeenLastCalledWith('r1', 'Unit SOP');
  });
});
