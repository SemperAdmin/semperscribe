import { describe, it, expect } from 'vitest';
import { detectDocumentType } from '@/services/import/docTypeDetector';
import { STRUCTURED_FORMS } from '@/hooks/useDocumentImport';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import type { ExtractedText } from '@/services/import/extractionTypes';

/**
 * A LIVE DATA-LOSS PATH, found 2026-08-25 while auditing whether the app
 * could import a signed NAVMC 10132 and continue filling it.
 *
 * It could not, and the way it failed was worse than not working. The PDF
 * text extractor reads the page CONTENT stream; every value on a NAVMC form
 * lives in an AcroForm widget's appearance stream, which that call never
 * touches. So a filled UPB extracted to the blank form's Privacy Act
 * boilerplate. The type detector's `^NAVMC` signal is line-anchored and
 * scoped to 30 lines, and "NAVMC 10132" first appears in the page FOOTER
 * around line 75, so nothing recognized the file. Detection fell through to
 * Basic Letter, and confirming called `resetDocumentState`, which builds a
 * fresh formData with no spread of the previous one.
 *
 * Net effect: a clerk with a Unit Punishment Book open imported their own
 * signed UPB, lost the entire case, and was told "Document imported."
 *
 * These tests hold the two halves of the fix. The refusal, so the review
 * modal never opens for a form. And the named replacement warning, so an
 * import over a structured document says what it will destroy rather than
 * only what it will create.
 */

/** A real ExtractedText, not a cast: the detector reads `lines`, and a cast
 *  that omitted a required field would hide a shape change here rather than
 *  fail on it. */
function extracted(lines: string[]): ExtractedText {
  return { lines, sourceFormat: 'pdf', warnings: [] };
}

/**
 * The opening of the real NAVMC 10132's extracted text, from
 * public/forms/navmc-10132-blank.pdf. The footer carrying "NAVMC 10132"
 * sits far outside the 30-line scan window, which is the whole reason the
 * old signal could not fire, so it is placed here where it really falls.
 */
function upbLines(): string[] {
  const head = [
    'Distribution: E-SRB                                    MCO 5800.16 Volume 14',
    'Copy to: OMPF, Files, Member                           UNIT PUNISHMENT BOOK (5812)',
    '',
    'PRIVACY ACT STATEMENT',
    'Authority: 10 U.S.C. 5013; 10 U.S.C. 5041; 10 U.S.C. 801-946a; 10 U.S.C. 2683;',
    'Purpose: Information will be used by designated command personnel to record and',
    'process non-judicial punishment actions.',
    'Routine Uses: Information is not routinely disclosed outside of DoD.',
    'Disclosure: Mandatory under MCO 5800.16.',
    'Records Management: This form shall be managed in accordance with Record Schedule 5000-82.',
    '1. UCMJ OFFENSES ALLEGED AND SUMMARIES (including date and place, but not victim PII).',
  ];
  // Pad past SCAN_WINDOW so the footer lands where it really does.
  const filler = Array.from({ length: 60 }, (_, i) => `instruction line ${i + 1}`);
  return [...head, ...filler, 'NAVMC 10132 (REV. 08-2023) (EF)'];
}

describe('a NAVMC form is refused, not imported as a Basic Letter', () => {
  it('refuses the real NAVMC 10132 shape, footer marker and all', () => {
    const detection = detectDocumentType(extracted(upbLines()));

    expect(detection.refuse).toBeTruthy();
    expect(detection.refuse?.label).toBe('a NAVMC form');
  });

  // The old behaviour, precisely. If this ever passes again the destructive
  // path is back.
  it('does not fall through to Basic Letter with a click-through warning', () => {
    const detection = detectDocumentType(extracted(upbLines()));

    expect(detection.warnings).not.toContain(
      'Could not recognize a document type; importing as a Basic Letter.',
    );
  });

  it('tells the user what to do instead, rather than only refusing', () => {
    const reason = detectDocumentType(extracted(upbLines())).refuse?.reason ?? '';

    // The working carrier for a form between sessions.
    expect(reason).toMatch(/library|\.nldp/);
    // And why nothing useful would have come out anyway.
    expect(reason).toMatch(/form fields/);
  });

  // Line 2 names the form even where the number does not appear, and it is
  // inside the scan window. Both markers are carried so a single page or a
  // differently split extraction still trips.
  it('refuses on the title alone, with no NAVMC number anywhere', () => {
    const detection = detectDocumentType(
      extracted(['Copy to: OMPF, Files, Member    UNIT PUNISHMENT BOOK (5812)', 'PRIVACY ACT STATEMENT']),
    );

    expect(detection.refuse).toBeTruthy();
  });

  it('refuses another NAVMC form, not only the 10132', () => {
    const detection = detectDocumentType(
      extracted(['ADMINISTRATIVE ACTION', 'some field labels', 'NAVMC 10274 (REV. 5-05)']),
    );

    expect(detection.refuse).toBeTruthy();
  });
});

/**
 * THE SECOND REFUSAL, AND IT WAS FOUND BY MEASUREMENT RATHER THAN REASONING.
 *
 * Three of the four NAVMC blanks this repo ships, the 10274, the 118(11) and
 * the 10922, are XFA forms. Their content lives in an XML payload that pdfjs
 * does not read, so the ENTIRE extracted text is Adobe's nine-line fallback
 * notice: no form number, no title, nothing the NAVMC check above can see.
 * The fix above would have missed all three. Running every shipped blank
 * through the real extractor is what turned that up, and it is why the
 * detector matches Adobe's own sentence rather than a form marker here.
 */
describe('an XFA form is refused, whatever form it is', () => {
  // Verbatim from public/forms/navmc-10274-blank.pdf via the real extractor.
  const XFA_FALLBACK = [
    'Please wait...',
    'If this message is not eventually replaced by the proper contents of the document, your PDF',
    'viewer may not be able to display this type of document.',
    'You can upgrade to the latest version of Adobe Reader for Windows®, Mac, or Linux® by',
    'visiting http://www.adobe.com/go/reader_download.',
  ];

  it('refuses a text layer that is only the Adobe fallback notice', () => {
    const detection = detectDocumentType(extracted(XFA_FALLBACK));

    expect(detection.refuse).toBeTruthy();
    expect(detection.refuse?.reason).toMatch(/XFA/);
  });

  it('explains that nothing of the form would come through, and what to do instead', () => {
    const reason = detectDocumentType(extracted(XFA_FALLBACK)).refuse?.reason ?? '';

    expect(reason).toMatch(/library|\.nldp/);
    expect(reason).toMatch(/replace the document you have open/);
  });

  // "Please wait..." alone is three common words. Matching on those would
  // refuse a real document that happens to contain them.
  it('does not refuse a letter merely because it says please wait', () => {
    const detection = detectDocumentType(
      extracted([
        'From:  Commanding Officer',
        'To:    Sergeant J. A. Doe',
        'Subj:  SCHEDULING',
        '',
        '1. Please wait for the hearing date before submitting the package.',
      ]),
    );

    expect(detection.refuse).toBeUndefined();
  });
});

/**
 * THE FALSE POSITIVE THIS COULD EASILY HAVE CREATED. A full-text unanchored
 * scan for "NAVMC 10132" also matches a naval letter that merely CITES the
 * form, and refusing those would break a working import to fix a broken
 * one. The discriminator is that a letter carries From, To and Subj, or a
 * civilian salutation, and a form carries none of them, because a form's
 * field values never reach the extracted text at all.
 */
describe('a letter that cites a NAVMC form still imports', () => {
  it('imports a From/To/Subj letter whose body names NAVMC 10132', () => {
    const detection = detectDocumentType(
      extracted([
        'UNITED STATES MARINE CORPS',
        '',
        'From:  Commanding Officer',
        'To:    Sergeant J. A. Doe',
        'Subj:  NONJUDICIAL PUNISHMENT PROCEDURES',
        '',
        '1. Complete the NAVMC 10132 in accordance with MCO 5800.16 Vol 14.',
      ]),
    );

    expect(detection.refuse).toBeUndefined();
    expect(detection.documentType).toBe('basic');
  });

  it('imports a business letter that mentions a Unit Punishment Book', () => {
    const detection = detectDocumentType(
      extracted([
        'August 14, 2026',
        '',
        'Dear Mr. Smith:',
        '',
        'Enclosed is guidance on the Unit Punishment Book process.',
      ]),
    );

    expect(detection.refuse).toBeUndefined();
    expect(detection.documentType).toBe('business-letter');
  });
});

/**
 * META GUARD. STRUCTURED_FORMS is keyed by DOCUMENT_TYPES registry id, and
 * those ids do not follow one convention: NAVMC 10274 is `aa-form`, NAVMC
 * 118(11) is `page11`. A wrong key produces NO warning rather than a wrong
 * one, so the failure is silent and this is what makes it loud. The first
 * draft of the map had two wrong keys.
 */
describe('the replacement warning is keyed to real document types', () => {
  it('names only ids the registry actually carries', () => {
    const unknown = Object.keys(STRUCTURED_FORMS).filter((id) => !(id in DOCUMENT_TYPES));

    expect(
      unknown,
      'STRUCTURED_FORMS (src/hooks/useDocumentImport.ts) is keyed by DOCUMENT_TYPES id, ' +
        'not by form number. An id not in the registry silently produces no warning.',
    ).toEqual([]);
  });

  it('covers the NAVMC 10132, which is the form the data-loss path was found on', () => {
    expect(STRUCTURED_FORMS.navmc10132).toMatch(/Unit Punishment Book/);
  });
});
