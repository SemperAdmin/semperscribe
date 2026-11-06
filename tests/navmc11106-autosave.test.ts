import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { isRecoverable, type WorkingCopy } from '@/lib/autosave';
import { NAVMC_11106_EMPTY_DEPENDENT } from '@/types/navmc';

const copy = (formData: Record<string, unknown>) =>
  ({ formData: { documentType: 'navmc11106', ...formData } as unknown as FormData, paragraphs: [] }) as unknown as WorkingCopy;

describe('NAVMC 11106 crash recovery', () => {
  it('offers a form with a name or an EDIPI', () => {
    expect(isRecoverable(copy({ nameOfMarine: 'MARINE, TEST' }))).toBe(true);
    expect(isRecoverable(copy({ edipi: '1234567890' }))).toBe(true);
  });

  it('offers a form with only a spouse or dependent row filled', () => {
    expect(isRecoverable(copy({ navmc11106Spouse: { ...NAVMC_11106_EMPTY_DEPENDENT, name: 'ALEX' } }))).toBe(true);
    expect(isRecoverable(copy({ navmc11106Dependents: [{ ...NAVMC_11106_EMPTY_DEPENDENT, relationship: 'SON' }] }))).toBe(true);
  });

  it('does not offer a blank form', () => {
    expect(isRecoverable(copy({}))).toBe(false);
    expect(isRecoverable(copy({ nameOfMarine: '  ', navmc11106Dependents: [{ ...NAVMC_11106_EMPTY_DEPENDENT }] }))).toBe(false);
  });
});
