/**
 * EDIPI inputs driven by a schema field definition take ten digits and
 * nothing else (owner, 2026-09-26: "we need to limit the edipi inputs to
 * 10"). The Page 11 details field is the one from the screenshot; the same
 * options sit on the NAVMC 10922, NAVMC 10132 and DD 368 definitions.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import type { FormData } from '@/types';

afterEach(cleanup);

const EDIPI_FIELDS: Array<[string, string]> = [
  ['page11', 'edipi'],
  ['navmc10922', 'edipi'],
  ['navmc10922', 'spouseEdipi'],
  ['navmc10132', 'accusedEdipi'],
  ['dd368', 'dd368Edipi'],
];

describe('EDIPI field definitions', () => {
  it.each(EDIPI_FIELDS)('%s.%s is capped at ten digits', (type, name) => {
    const field = DOCUMENT_TYPES[type].sections.flatMap((s) => s.fields).find((f) => f.name === name);
    expect(field, `${type}.${name}`).toBeDefined();
    expect(field!.maxLength).toBe(10);
    expect(field!.digitsOnly).toBe(true);
    expect(field!.inputMode).toBe('numeric');
  });

  it('the Page 11 schema requires the ten-digit form', () => {
    const schema = DOCUMENT_TYPES.page11.schema;
    const base = { documentType: 'page11', name: 'MARINE, TEST A.' };
    expect(schema.safeParse({ ...base, edipi: '1234567890' }).success).toBe(true);
    expect(schema.safeParse({ ...base, edipi: '11111111111111111111' }).success).toBe(false);
    expect(schema.safeParse({ ...base, edipi: '123' }).success).toBe(false);
  });
});

describe('DynamicForm text input with digitsOnly and maxLength', () => {
  it('keeps the first ten digits of what is typed or pasted into the Page 11 EDIPI', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <DynamicForm
        documentType={DOCUMENT_TYPES.page11}
        onSubmit={onSubmit}
        defaultValues={{ documentType: 'page11', name: '', edipi: '' } as unknown as FormData}
      />,
    );
    const input = container.querySelector('[name="edipi"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.maxLength).toBe(10);
    expect(input.getAttribute('inputmode')).toBe('numeric');

    fireEvent.change(input, { target: { value: 'EDIPI 11111111111111111111' } });
    await waitFor(() => expect(input.value).toBe('1111111111'));
    // The watch subscription debounces at 500ms.
    await waitFor(() => expect(onSubmit).toHaveBeenCalled(), { timeout: 4000 });
    const payload = onSubmit.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.edipi).toBe('1111111111');
  });
});
