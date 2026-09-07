/**
 * Item 21 overflow onto continuation pages.
 *
 * THE DEFECT THIS FIXES IS SILENT DATA LOSS. Item 21 is a 55-line multiline
 * widget and the app has always known that number: navmc10132-field-metrics
 * records `lines: 55`. Nothing read it. `fitsInField` measures every
 * newline-separated line against the field WIDTH and its own comment admits
 * the gap in as many words: "A value with more newline separated lines than
 * the field's line count is not flagged here, this function only checks
 * horizontal (per line) overflow, not vertical overflow from too many
 * lines." So a 63-line item 21 printed 55 lines and dropped eight, with
 * nothing on screen to say so.
 *
 * That matters more on this form than on most. Item 21 is where the page 3
 * instruction sends every overflow the form cannot hold: offenses F and
 * beyond, item 6 and item 7 when they exceed their single-line widgets,
 * additional victims, and the vacation record. It is the form's own
 * pressure-relief valve, and the valve was leaking.
 *
 * STEPHEN'S RULING, 2026-08-27, after the 26 August demo where an attendee
 * asked "if the access page gets filled, have another access page show up to
 * allow even more": continuation pages, and no blocking gate. The export
 * carries the overflow rather than refusing it.
 *
 * WHY LINE COUNTING IS SOUND HERE AND WOULD NOT BE ON A WRAPPING FIELD.
 * V-09 blocks any item 21 line wider than the widget, so by the time a
 * document exports, one source line is one rendered line. Acrobat never
 * wraps, because nothing is ever wide enough to need it. That makes the
 * newline count the rendered line count exactly.
 */

import { NAVMC_10132_FIELD_METRICS } from '@/lib/navmc10132-field-metrics';

/** The widget's own line capacity, read rather than restated. */
export const ITEM_21_FIELD = '21 REMARKS';

/**
 * Lines item 21 renders before clipping.
 *
 * READ FROM THE METRICS TABLE. Hard-coding 55 here would put the number in
 * two places, and the table is the one measured against the real widget.
 */
export function item21LineCapacity(): number {
  const metrics = NAVMC_10132_FIELD_METRICS[ITEM_21_FIELD];
  const lines = metrics?.lines;
  // A missing entry means the metrics table was edited out from under this
  // module. Treating that as "unlimited" would restore the silent clipping
  // this module exists to end, so it fails loud instead.
  if (typeof lines !== 'number' || lines < 2) {
    throw new Error(
      `navmc10132-field-metrics has no usable line count for "${ITEM_21_FIELD}". ` +
        'Item 21 cannot be paginated without it.',
    );
  }
  return lines;
}

export interface Item21Pagination {
  /** What item 21 itself prints, always within the widget's capacity. */
  onForm: string;
  /** The lines that did not fit, in order. Empty when nothing spilled. */
  overflow: string[];
  /** True when anything spilled. Callers render a supplement only then. */
  overflowed: boolean;
}

/**
 * The last line inside the widget when anything spills.
 *
 * NO PAGE COUNT IN THIS SENTENCE, deliberately. The count is not known until
 * the supplement renders, and the supplement paginates by line count inside
 * renderMonospacePdf. Naming a number here would mean rendering first to
 * learn it and composing the form value second, which puts an async call in
 * the middle of navmc10132Values, a synchronous table. The supplement's own
 * footer carries "Page 1 of 2", so the count is stated where it is known.
 */
export const ITEM_21_CONTINUATION_POINTER =
  'Continued on the attached item 21 supplemental page.';

/**
 * Splits a composed item 21 into what the widget holds and what follows.
 *
 * THE POINTER COSTS A LINE ON THE FORM, and that is the point. A reader
 * holding the form has to learn that more exists, so the last line inside
 * the widget says so. Reserving it means the form carries capacity-1 lines
 * of content, never capacity, whenever anything spills.
 *
 * NEVER SPLITS A LINE. Pagination happens at newline boundaries only, so a
 * sentence never breaks across the form and a supplemental page. Every line
 * is already width-checked by V-09, so no line needs breaking.
 */
export function paginateItem21(
  composed: string,
  capacity: number = item21LineCapacity(),
): Item21Pagination {
  const lines = composed === '' ? [] : composed.split('\n');

  if (lines.length <= capacity) {
    return { onForm: composed, overflow: [], overflowed: false };
  }

  const kept = lines.slice(0, capacity - 1);
  return {
    onForm: [...kept, ITEM_21_CONTINUATION_POINTER].join('\n'),
    overflow: lines.slice(capacity - 1),
    overflowed: true,
  };
}

/**
 * Renders the overflow as a supplemental sheet.
 *
 * A SEPARATE FILE RATHER THAN AN APPENDED PAGE, and the reason is the
 * signature guarantee. `exportNavmc10132Form` has two paths. The blank path
 * does a full rewrite and could take an appended page trivially. The signed
 * path writes an incremental update into the clerk's uploaded file and
 * touches no byte that came before, which is the whole reason their CAC
 * signatures survive a round trip. Appending a page there means rewriting
 * the page tree, which is a change after signing, and teaching
 * navmc10132-incremental-write.ts to do it safely is a change to the one
 * module whose correctness the signatures rest on.
 *
 * Splitting the behaviour by path would be worse than either: the same
 * document would produce one file before it was signed and two afterwards.
 * So both paths produce a sheet, and the clerk staples it the way they
 * already staple the A-1-c rights form, the A-1-f script, the Page 11 and
 * the unit diary worksheet, none of which live inside the UPB either.
 *
 * MONOSPACE, like every other sheet this app produces for a clerk to read
 * beside a form. renderMonospacePdf paginates by line count on its own, so
 * a supplement of any length comes back correctly numbered.
 */
export async function renderItem21Continuation(
  overflow: readonly string[],
  accused: { name: string; edipi: string },
): Promise<{ blob: Blob; pageCount: number }> {
  if (overflow.length === 0) {
    throw new Error('renderItem21Continuation called with nothing to continue.');
  }

  const { renderMonospacePdf } = await import('@/lib/monospace-pdf');
  const { bytes, pageCount } = await renderMonospacePdf(overflow, {
    title: `NAVMC 10132 item 21 continuation - ${accused.name || 'accused'}`,
    subject: 'Unit Punishment Book, item 21 remarks continuation',
    // ON EVERY PAGE, because a supplemental sheet separated from the form is
    // a page of remarks about a Marine nobody can identify. The header is
    // the only thing tying it back.
    header: `NAVMC 10132 ITEM 21 CONTINUATION - ${accused.name || '[NAME]'} - EDIPI ${accused.edipi || '[EDIPI]'}`,
    footerLeft: 'Item 21 continuation',
    footerRight: 'NAVMC 10132 (REV. 08-2023)',
    caption:
      'These lines continue item 21 of the attached NAVMC 10132. They did not fit the ' +
      'field and are part of that record.',
  });

  return { blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), pageCount };
}
