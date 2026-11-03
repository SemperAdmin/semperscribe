import { describe, it, expect } from 'vitest';
import { buildLetterheadReport } from '@/lib/letterhead-report';

describe('buildLetterheadReport', () => {
  it('leads with RUC and MCC and lists the lines as they print', () => {
    const text = buildLetterheadReport({
      ruc: '06015',
      mcc: 'G91',
      lines: ['MARINE AVIATION TRAINING SUPPORT GROUP 23', '', '211 FARRAR ROAD', 'PENSACOLA FLORIDA 32508-5009'],
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('UNIT LETTERHEAD CORRECTION');
    expect(lines[1]).toBe('RUC: 06015  MCC: G91');
    expect(text).toContain('CURRENT LETTERHEAD IN SEMPERSCRIBE:\nMARINE AVIATION TRAINING SUPPORT GROUP 23\n211 FARRAR ROAD\nPENSACOLA FLORIDA 32508-5009\n');
    expect(text).toContain('CORRECT LETTERHEAD');
  });

  it('asks for the codes when the unit was not picked from the directory', () => {
    const text = buildLetterheadReport({ lines: [] });
    expect(text).toContain('RUC: (ENTER RUC)  MCC: (ENTER MCC)');
    expect(text).toContain('(UNIT NOT FOUND IN DIRECTORY)');
  });
});
