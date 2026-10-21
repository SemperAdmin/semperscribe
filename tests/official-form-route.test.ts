import { describe, it, expect } from 'vitest';
import { aaFormUsesOfficialForm, hasBoundEnclosureFiles, signatureFieldCount } from '@/lib/official-form-route';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-rows';

const row = (fileId?: string) => ({ id: 'r1', text: 'Orders', fileId }) as unknown as EnclosureRow;
const files = (id: string) => new Map([[id, {} as EnclosureAttachment]]);

describe('official-form route', () => {
  it('counts signature fields, tolerating their absence', () => {
    expect(signatureFieldCount({})).toBe(0);
    expect(signatureFieldCount({ signatureFields: [{ id: 'a' }] } as never)).toBe(1);
  });

  it('sees a bound file only when its row points at an attachment the map holds', () => {
    expect(hasBoundEnclosureFiles(undefined, undefined)).toBe(false);
    expect(hasBoundEnclosureFiles([row()], files('f1'))).toBe(false);
    expect(hasBoundEnclosureFiles([row('f1')], undefined)).toBe(false);
    expect(hasBoundEnclosureFiles([row('f1')], files('f1'))).toBe(true);
  });

  it('routes the AA Form to the official form until a signature field or a bound file forces the redraw', () => {
    expect(aaFormUsesOfficialForm({ documentType: 'aa-form' })).toBe(true);
    expect(aaFormUsesOfficialForm({ documentType: 'aa-form', signatureFields: [{ id: 's' }] } as never)).toBe(false);
    expect(aaFormUsesOfficialForm({ documentType: 'aa-form' }, [row('f1')], files('f1'))).toBe(false);
    expect(aaFormUsesOfficialForm({ documentType: 'basic' })).toBe(false);
  });
});
