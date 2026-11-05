/**
 * TLA Packet: what prints, and how the document type sits in the app.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { PDFDocument } from 'pdf-lib';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { isRecoverable, type WorkingCopy } from '@/lib/autosave';
import { defaultDraftTitle } from '@/lib/draft-title';
import { getExportFilename } from '@/lib/naval-format-utils';
import { panelScopeNote, reviewUnavailableReason } from '@/lib/gunnybot/document-scope';
import { runLetterValidators } from '@/lib/letter-validators';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { emptyTlaPeriod, runTlaValidators, type TlaPeriod } from '@/lib/tla';
import { generateTlaPacket, tlaPacketModel } from '@/services/pdf/tlaPacketGenerator';
import type { FormData } from '@/types';

afterEach(cleanup);

function period(p: Partial<TlaPeriod> = {}): TlaPeriod {
  return {
    ...emptyTlaPeriod(),
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    memberOccupying: true,
    dailyLodgingCost: '150',
    ...p,
  };
}

function form(fields: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'tla-packet',
    tlaMarineLastName: 'Rivera',
    tlaMarineFirstName: 'Ana',
    tlaMarineGrade: 'SSgt',
    tlaMarineEdipi: '1234567890',
    tlaUnit: 'Example Battalion',
    tlaPds: 'Camp Example, Japan',
    tlaSituation: 'arrival',
    tlaPeriods: [period()],
    ...fields,
  } as unknown as FormData;
}

async function pages(formData: FormData): Promise<number> {
  const bytes = await generateTlaPacket(formData);
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('tlaPacketModel', () => {
  it('says it supports the NAVMC 11116 and is not an official form', () => {
    const { subtitle } = tlaPacketModel(form());
    expect(subtitle).toMatch(/NAVMC 11116/);
    expect(subtitle).toMatch(/Not an official form/i);
  });

  it('prints the lodging actually paid, and says finance computes the amount', () => {
    const model = tlaPacketModel(form());
    expect(model.lines).toHaveLength(1);
    expect(model.lines[0].dailyLodging).toBe(150);
    expect(model.lodgingTotalText).toBe('$750.00');
    expect(model.totalDays).toBe(5);
    expect(model.lodgingNote).toMatch(/finance/i);
    expect(model.lodgingNote).toMatch(/per diem/i);
  });

  it('prints no rate, ceiling, percentage or computed TLA anywhere', () => {
    const printed = JSON.stringify(tlaPacketModel(form({ tlaRequestKind: 'additional', tlaAdditionalReason: 'hhg' })));
    expect(printed).not.toMatch(/lodgingCeiling|lodgingPct|miePct|totalText|perDiem/);
    expect(printed).not.toMatch(/Table 68-11/);
  });

  it('prints an entered zero GTCC split as zero with the duty it carries', () => {
    const model = tlaPacketModel(form({ tlaGtccSplit: '0' }));
    expect(model.gtccText).toBe('$0.00');
    expect(model.gtccNote).toMatch(/pay/i);
  });

  it('leaves a blank GTCC split blank instead of printing zero', () => {
    expect(tlaPacketModel(form()).gtccText).toBe('');
  });

  it('prints only the certificates the situation calls for', () => {
    expect(tlaPacketModel(form()).certificates).toEqual([]);
    const model = tlaPacketModel(form({ tlaCertMilitaryNecessity: true, tlaCertNearestLodging: true }));
    expect(model.certificates.map((c) => c.id)).toEqual(['military-necessity', 'nearest-lodging']);
    for (const c of model.certificates) {
      expect(c.citation).toMatch(/FMR/);
      expect(c.signer.trim()).not.toBe('');
    }
  });

  it('prints the additional-period justification only on an additional request', () => {
    expect(tlaPacketModel(form()).additional).toBeNull();
    const model = tlaPacketModel(form({
      tlaRequestKind: 'additional', tlaAdditionalReason: 'hhg', tlaAdditionalNarrative: 'Shipment delayed at port.',
      tlaDailyTla: '215', tlaDailyHousingAllowance: '95.50',
    }));
    expect(model.additional?.reason).toMatch(/household goods/i);
    expect(model.additional?.narrative).toBe('Shipment delayed at port.');
    expect(model.additional?.housingAllowance).toBe('$95.50');
    expect(model.additional?.dailyTla).toBe('$215.00');
  });

  it('shows the lodging expense most days carry on an additional request', () => {
    const model = tlaPacketModel(form({
      tlaRequestKind: 'additional',
      tlaPeriods: [period({ endDate: '2026-11-01', dailyLodgingCost: '300' }), period({ startDate: '2026-11-02', endDate: '2026-11-10', dailyLodgingCost: '180' })],
    }));
    expect(model.additional?.dailyLodging).toBe('$180.00');
  });

  it('routes a departure claim to the departing disbursing or finance office', () => {
    const departure = tlaPacketModel(form({ tlaSituation: 'departure' }));
    expect(departure.checklist.join(' ')).toMatch(/departing/i);
    expect(tlaPacketModel(form()).checklist.join(' ')).not.toMatch(/departing/i);
  });

  it('asks for advance details and not receipts on an advance', () => {
    const advance = tlaPacketModel(form({ tlaRequestKind: 'advance' })).checklist.join(' ');
    expect(advance).toMatch(/flight date/i);
    expect(advance).not.toMatch(/Itemized lodging receipts for every/i);
    expect(tlaPacketModel(form()).checklist.join(' ')).toMatch(/Itemized lodging receipts for every/i);
  });

  it('is the request itself, so it never sends the drafter to a local form', () => {
    expect(tlaPacketModel(form()).checklist.join(' ')).not.toMatch(/local TLA request form/i);
  });

  it('prints dates the way the rest of the app does', () => {
    expect(tlaPacketModel(form()).lines[0].dateText).toBe('1 Nov 26 - 5 Nov 26');
  });
});

describe('generateTlaPacket', () => {
  it('writes a loadable PDF for a blank packet', async () => {
    expect(await pages({ documentType: 'tla-packet' } as unknown as FormData)).toBeGreaterThan(0);
  });

  it('keeps a full additional-period request on one sheet, with no page left holding only a note', async () => {
    const family = { dependents12Plus: '2', dependentsUnder12: '2', kitchen: true, lodgingName: 'Example Suites, Chatan' };
    const count = await pages(form({
      tlaRequestKind: 'additional',
      tlaAdditionalReason: 'hhg',
      tlaAdditionalNarrative: 'Household goods shipment delayed at port.',
      tlaGtccSplit: '2500',
      tlaHousingOverlap: true,
      tlaOverlapComment: 'Overlap authorized by the local order.',
      tlaPeriods: [
        period({ ...family, startDate: '2026-12-01', endDate: '2026-12-08' }),
        period({ ...family, startDate: '2026-12-09', endDate: '2026-12-15', extraRoomCharge: '155' }),
      ],
    }));
    // Request, housing statement, routing.
    expect(count).toBe(3);
  });

  it('adds pages as the lodging periods and certificates grow', async () => {
    const small = await pages(form());
    const many = Array.from({ length: 60 }, (_, i) => period({
      startDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      endDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    }));
    const large = await pages(form({
      tlaPeriods: many,
      tlaCertMilitaryNecessity: true, tlaCertGovQuarters: true, tlaCertNearestLodging: true, tlaCertBeforeOrders: true, tlaCertEarlyTermination: true,
    }));
    expect(large).toBeGreaterThan(small);
  });

  it('survives text the standard font cannot encode', async () => {
    expect(await pages(form({
      tlaMarineLastName: 'Núñez 日本',
      tlaPeriods: [period({ lodgingName: 'Hotel “Okinawa” — 沖縄' })],
    }))).toBeGreaterThan(0);
  });

  it('runs through the app pipeline to a PDF blob', async () => {
    const blob = await generatePdfForDocType({ formData: form(), vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [] });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});

describe('the document type in the app', () => {
  it('registers as a PDF-only form on its own pipeline', () => {
    const def = DOCUMENT_TYPES['tla-packet'];
    expect(def.name).toBe('TLA Packet');
    expect(def.features.category).toBe('forms');
    expect(def.features.pdfPipeline).toBe('tla-packet');
    expect(def.features.exportFormats).toEqual(['pdf']);
    expect(def.features.showParagraphs).toBe(false);
  });

  it('accepts its own fields through the schema, keeping the periods', () => {
    const parsed = DOCUMENT_TYPES['tla-packet'].schema.parse(form({ tlaPeriods: [period({ lodgingName: 'Example Inn' })] }));
    const periods = (parsed as unknown as { tlaPeriods: TlaPeriod[] }).tlaPeriods;
    expect(periods).toHaveLength(1);
    expect(periods[0].lodgingName).toBe('Example Inn');
  });

  it('is offered in the Forms group of the sidebar', () => {
    const onDocumentTypeChange = vi.fn();
    render(<Sidebar documentType="basic" onDocumentTypeChange={onDocumentTypeChange} formData={{ documentType: 'basic' } as FormData} />);
    fireEvent.click(screen.getByRole('button', { name: /^Forms$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'TLA Packet' }));
    expect(onDocumentTypeChange).toHaveBeenLastCalledWith('tla-packet');
  });

  it('titles a saved draft and names the export by the Marine', () => {
    expect(defaultDraftTitle(form())).toBe('TLA - Rivera - 2026-11-01');
    expect(getExportFilename(form(), 'pdf')).toMatch(/^TLA Packet - Rivera/);
  });

  it('offers an unsaved packet for recovery, and not a blank one', () => {
    const copy = (formData: FormData) => ({ formData, paragraphs: [] }) as unknown as WorkingCopy;
    expect(isRecoverable(copy(form()))).toBe(true);
    expect(isRecoverable(copy({ documentType: 'tla-packet', tlaPeriods: [period()] } as unknown as FormData))).toBe(true);
    expect(isRecoverable(copy({ documentType: 'tla-packet' } as unknown as FormData))).toBe(false);
  });

  it('keeps GunnyBot review closed and says the packet is not sent', () => {
    expect(panelScopeNote('tla-packet')).toMatch(/TLA Packet is not sent/);
    expect(reviewUnavailableReason('tla-packet')).toMatch(/TLA Packet/);
    expect(panelScopeNote('counseling')).toMatch(/Counseling Worksheet is not sent/);
    expect(reviewUnavailableReason('counseling')).toMatch(/Counseling Worksheet/);
  });

  it('shows the rule checks in proofread as warnings that block nothing', () => {
    const issues = runTlaValidators(form({ tlaPriorDays: '70' }));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
    expect(issues.map((i) => i.id)).toContain('tla-arrival-over-60');
    expect(runTlaValidators({ documentType: 'basic' } as FormData)).toEqual([]);
  });

  it('raises no letter rules against a packet, which has no letter parts', () => {
    const all = runLetterValidators(form({ tlaReceiptsAttached: true, tlaGtccSplit: '0', tlaHousingLog: [{ date: '2026-11-01', action: 'Registered' }] }), [], [], []);
    expect(all.filter((i) => i.severity !== 'warn')).toEqual([]);
  });
});
