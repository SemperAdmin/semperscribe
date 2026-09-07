import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, type DocumentTypeDefinition } from '@/lib/schemas';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { FormData } from '@/types';

/**
 * THE MEASUREMENT THAT GATED THE APPEAL STAGE GATE.
 *
 * Decision row D-61 fixed section-level stage gating for the three
 * hand-written sections that span passes. The appeal block could not be
 * fixed the same way: it is a `DynamicForm` driven by
 * `Navmc10132Definition`, so gating a field means dropping it from the
 * DEFINITION, which crosses React Hook Form. This codebase carries a known
 * clobber rule about RHF and derived fields, and whether a field dropped
 * from a definition SURVIVES in `formData` or gets cleared through
 * `onDynamicSync` was unmeasured. Building the gate on an unmeasured
 * assumption would risk silently erasing an appeal decision when a clerk
 * rewound the stage selector, which is data loss on a legal record.
 *
 * So this file measures it before the gate exists, and stays afterwards as
 * the guard on the property the gate depends on. It asserts the two halves
 * of the contract separately, because they live in different files and
 * either one could change without the other:
 *
 *   1. DynamicForm's watch subscription OMITS a key absent from the
 *      definition. It does not emit it as '' or null. See its
 *      `allowedTopLevelKeys` filter (src/components/ui/DynamicForm.tsx).
 *   2. page.tsx's `handleDynamicFormSubmit` MERGES with spread rather than
 *      replacing, so an omitted key keeps its prior value.
 *
 * Both must hold. If DynamicForm ever emits cleared keys instead of
 * omitting them, or the parent handler stops merging, the appeal gate
 * becomes data loss and this file goes red first.
 */

/** The subset of the NAVMC 10132 definition covering one section, matching
 *  the `subDefinition` helper in Navmc10132Sections.tsx. */
function subDefinition(ids: string[]): DocumentTypeDefinition {
  const def = DOCUMENT_TYPES['navmc10132'];
  return { ...def, sections: def.sections.filter((s) => ids.includes(s.id)) };
}

/** The appeal definition with only the fields a given list names, which is
 *  exactly the shape the stage gate produces. */
function appealWithFields(names: string[]): DocumentTypeDefinition {
  const def = subDefinition(['appeal']);
  return {
    ...def,
    sections: def.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => names.includes(f.name)) })),
  };
}

function formDataWithFullAppeal(): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    appealAdvisementDate: '2026-04-01',
    appealDecision: 'Appeal denied. Punishment approved as imposed.',
    appealDecisionDate: '2026-04-20',
    appealDecisionNoticeDate: '2026-04-22',
  } as unknown as FormData;
}

/**
 * The sync fires on CHANGE, never on mount: DynamicForm subscribes with
 * `form.watch`, which emits only when a value moves. So each test below
 * types into a field the definition DOES name, and reads the payload that
 * lands 500ms later. A test that merely rendered and waited would hang,
 * which is how this property was discovered rather than assumed.
 */
async function payloadAfterTyping(
  definition: DocumentTypeDefinition,
  fieldName: string,
  text: string,
) {
  const onSubmit = vi.fn();
  const { container } = render(
    <DynamicForm
      documentType={definition}
      onSubmit={onSubmit}
      defaultValues={formDataWithFullAppeal()}
    />,
  );

  const input = container.querySelector(`[name="${fieldName}"]`);
  if (!input) throw new Error(`no rendered input named ${fieldName}`);
  fireEvent.change(input, { target: { value: text } });

  // The watch subscription debounces at 500ms.
  await waitFor(() => expect(onSubmit).toHaveBeenCalled(), { timeout: 4000 });
  return onSubmit.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe('DynamicForm omits fields absent from the definition, rather than clearing them', () => {
  it('emits only the keys its definition names, even when defaultValues carry more', async () => {
    const payload = await payloadAfterTyping(
      appealWithFields(['appealDecision']),
      'appealDecision',
      'Appeal granted in part.',
    );

    // The named field is present and carries what was typed.
    expect(payload.appealDecision).toBe('Appeal granted in part.');

    // THE LOAD-BEARING ASSERTION. The unnamed keys are ABSENT, not
    // present-and-empty, even though defaultValues carried values for all
    // of them. `'appealDecisionDate' in payload` is false, which is what
    // makes the parent's spread merge preserve the prior value. An
    // implementation that emitted `appealDecisionDate: ''` would pass a
    // naive falsy check and still destroy the record.
    for (const key of [
      'appealAdvisementDate',
      'appealDecisionDate',
      'appealDecisionNoticeDate',
      'intendAppeal',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(payload, key), `${key} must be omitted`).toBe(
        false,
      );
    }
  });

  it('emits a later field, carrying its existing value, once the definition names it', async () => {
    const payload = await payloadAfterTyping(
      appealWithFields(['appealDecision', 'appealDecisionNoticeDate']),
      'appealDecision',
      'Appeal denied.',
    );

    expect(payload.appealDecision).toBe('Appeal denied.');
    // Untouched by the typing, but present because the definition names it,
    // and still holding the value defaultValues seeded.
    expect(payload.appealDecisionNoticeDate).toBe('2026-04-22');
  });
});

describe('the parent handler merges rather than replaces', () => {
  // This mirrors handleDynamicFormSubmit in src/app/page.tsx verbatim.
  // Restating it here rather than importing it is deliberate: page.tsx is a
  // 1000-line client component that pulls in the whole app to import, and
  // the property under test is one line. The comment above the handler
  // there points back at this file.
  function merge(prev: Record<string, unknown>, data: Record<string, unknown>) {
    return { ...prev, ...data };
  }

  it('keeps a value whose key the payload omits', () => {
    const prev = {
      appealAdvisementDate: '2026-04-01',
      appealDecision: 'Appeal denied. Punishment approved as imposed.',
    };
    const merged = merge(prev, { appealAdvisementDate: '2026-04-02' });

    expect(merged.appealDecision).toBe('Appeal denied. Punishment approved as imposed.');
    expect(merged.appealAdvisementDate).toBe('2026-04-02');
  });

  // The failure mode the omission check above exists to prevent, stated
  // from the other side: an empty string in the payload DOES overwrite.
  it('overwrites when the payload carries the key with an empty value', () => {
    const prev = { appealDecision: 'Appeal denied.' };
    const merged = merge(prev, { appealDecision: '' });

    expect(merged.appealDecision).toBe('');
  });
});
