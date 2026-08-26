import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * WHAT THE APP TELLS A USER ABOUT ITS OWN HANDLING OF THEIR DATA.
 *
 * Stephen rewrote the banner on 26 August 2026 after noticing the old one
 * was false in practice: it said "Do not enter CUI, PII, or other sensitive
 * information" on an app built to hold a unit punishment book. He first
 * proposed replacing the prohibition with "the user is responsible for its
 * use", which is worse, because for CUI the obligation attaches to the
 * SYSTEM under 32 CFR 2002 and DoDI 5200.48 and for PII to the agency under
 * 5 USC 552a. Consent creates no ATO, no SORN and no PIA.
 *
 * What shipped instead states what the app does: no server, no
 * transmission, storage on the user's own machine, so the machine is what
 * has to be approved.
 *
 * THIS FILE GUARDS THE TWO WAYS THAT SENTENCE GOES WRONG AGAIN.
 *
 *   1. Someone reinstates the prohibition the workflow contradicts.
 *   2. Someone tightens "stays on this computer" into "stores nothing",
 *      which is FALSE. The uploaded signed UPB is several megabytes in the
 *      enclosureFiles store until Clear Form removes it, and a user told
 *      nothing persists closes the tab on a shared workstation with a
 *      Marine's signed record still in the browser.
 *
 * WHAT THIS CANNOT CATCH, stated the way the other meta guards in this repo
 * state their limits: wording that means "stores nothing" without using
 * these phrases, a claim added to a file outside the two scanned here, and
 * anything about whether the sentence is LEGALLY right, which is a question
 * for a CDRM and an ISSM rather than for a test.
 */

const SRC = join(process.cwd(), 'src');
const BANNER = join(SRC, 'components', 'layout', 'ModernAppShell.tsx');
const NOTICE = join(SRC, 'app', 'privacy', 'page.tsx');

/** Only the rendered text, so a comment explaining the history is not a hit. */
function renderedText(file: string): string {
  const source = readFileSync(file, 'utf-8');
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ');
}

describe('the banner says what the app does', () => {
  const banner = renderedText(BANNER);

  // Sanity check first, matching the house pattern: a scan that reads
  // nothing passes every assertion below for the wrong reason.
  it('reads the banner file and finds the banner in it', () => {
    expect(banner.length).toBeGreaterThan(2000);
    expect(banner).toContain('Non-official Proof of Concept');
  });

  it('does not claim the app stores nothing', () => {
    for (const phrase of [
      'stores no data',
      'does not store',
      'no data is stored',
      'nothing is stored',
      'stores nothing',
    ]) {
      expect(banner.toLowerCase(), phrase).not.toContain(phrase);
    }
  });

  it('does not reinstate a prohibition the workflow contradicts', () => {
    expect(banner).not.toContain('Do not enter CUI');
    expect(banner.toLowerCase()).not.toContain('must not enter');
  });

  // The load-bearing half. Removing these would leave a banner that says
  // nothing useful about where the document goes.
  it('tells the user the documents stay on this computer, and to use an approved one', () => {
    expect(banner).toContain('no transmission');
    expect(banner).toContain('this browser on this computer');
    expect(banner).toContain('until you clear them');
    expect(banner).toContain('approved for the information you enter');
  });

  // Unchanged by the rewrite and independently required.
  it('keeps the Federal records statement and the CDRM routing', () => {
    expect(banner).toContain('44 USC 3301');
    expect(banner).toContain('CDRM');
  });
});

describe('the privacy notice agrees with the banner', () => {
  const notice = renderedText(NOTICE);

  it('reads the notice file', () => {
    expect(notice.length).toBeGreaterThan(3000);
    expect(notice).toContain('Privacy and Security Notice');
  });

  // These were the two false claims, removed 26 August 2026. The notice now
  // explains their removal in prose, which is why the assertions below are
  // on the CLAIM rather than on the words appearing anywhere on the page.
  it('no longer claims the formatter does not store PII or process CUI', () => {
    expect(notice).not.toContain('does not collect, store, or transmit Personally');
    expect(notice).not.toContain('does not collect, process, or transmit Controlled');
  });

  it('names what persists and where', () => {
    expect(notice).toContain('What Persists');
    expect(notice).toContain('enclosureFiles');
    expect(notice).toContain('IndexedDB');
  });

  it('says the machine is what has to be approved', () => {
    expect(notice.toLowerCase()).toContain('approved for the information entered');
  });

  // GitHub Pages sees every request URL, which is the concrete reason the
  // share payload moved to the fragment.
  it('discloses that the host sees request URLs', () => {
    expect(notice).toContain('GitHub');
    expect(notice.toLowerCase()).toContain('fragment');
  });
});
