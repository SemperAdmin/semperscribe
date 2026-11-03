import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildLetterheadReport, sendLetterheadReport, letterheadReportMessage } from '@/lib/letterhead-report';
import * as urlState from '@/lib/url-state';

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

describe('sendLetterheadReport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports a blocked tab', async () => {
    vi.spyOn(urlState, 'copyToClipboard').mockResolvedValue(true);
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await sendLetterheadReport({ lines: [] })).toEqual({ copied: true, opened: false });
  });

  it('reports an opened tab and cuts its opener', async () => {
    vi.spyOn(urlState, 'copyToClipboard').mockResolvedValue(false);
    const tab = { opener: window } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(tab);
    expect(await sendLetterheadReport({ lines: [] })).toEqual({ copied: false, opened: true });
    expect(tab.opener).toBeNull();
  });
});

describe('letterheadReportMessage', () => {
  it('names the blocked form and points to Send Feedback', () => {
    expect(letterheadReportMessage({ copied: true, opened: true }).description).toContain('just opened');
    expect(letterheadReportMessage({ copied: true, opened: false }).description).toContain('blocked the feedback form');
    expect(letterheadReportMessage({ copied: false, opened: true }).title).toBe('Copy failed');
    expect(letterheadReportMessage({ copied: false, opened: false }).description).toContain('Send Feedback');
  });
});
