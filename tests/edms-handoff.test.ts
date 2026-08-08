import { describe, it, expect, beforeEach } from 'vitest';
import { parseEdmsHash, buildEdmsUrl } from '@/lib/edms-handoff';
import {
  setEdmsContext,
  getEdmsContext,
  isEdmsMode,
  clearEdmsContext,
  resetEdmsCacheForTests,
  edmsBaseFilename,
  EDMS_ALLOWED_PROVIDER,
} from '@/lib/edms-mode';

const GOOD = '#edms=v=1&rid=482&ruc=12345&ssic=1650&doc=basic&sec=S-1';

describe('parseEdmsHash', () => {
  it('parses a well-formed link', () => {
    expect(parseEdmsHash(GOOD)).toEqual({
      version: 1,
      requestId: '482',
      ruc: '12345',
      ssic: '1650',
      docType: 'basic',
      section: 'S-1',
    });
  });

  it('treats section as optional', () => {
    const r = parseEdmsHash('#edms=v=1&rid=7&ruc=A1&ssic=5216&doc=endorsement');
    expect(r?.section).toBeUndefined();
    expect(r?.requestId).toBe('7');
  });

  it('accepts a five-digit SSIC', () => {
    expect(parseEdmsHash('#edms=v=1&rid=7&ruc=A1&ssic=12345&doc=memo')?.ssic).toBe('12345');
  });

  it('ignores a non-edms fragment', () => {
    expect(parseEdmsHash('#es=abc123')).toBeNull();
    expect(parseEdmsHash('')).toBeNull();
    expect(parseEdmsHash('#')).toBeNull();
  });

  it('rejects an unknown version rather than guessing', () => {
    expect(parseEdmsHash('#edms=v=2&rid=1&ruc=A&ssic=1650&doc=memo')).toBeNull();
    expect(parseEdmsHash('#edms=rid=1&ruc=A&ssic=1650&doc=memo')).toBeNull();
  });

  it('tolerates a v-prefixed version token', () => {
    expect(parseEdmsHash('#edms=v=v1&rid=1&ruc=A&ssic=1650&doc=memo')?.version).toBe(1);
  });

  // A half-populated form is a worse state than a blank one: the Marine
  // cannot tell which fields came from EDMS and which are stale.
  it.each([
    ['non-numeric rid', '#edms=v=1&rid=48a&ruc=12345&ssic=1650&doc=memo'],
    ['ruc with punctuation', '#edms=v=1&rid=1&ruc=123-45&ssic=1650&doc=memo'],
    ['three-digit ssic', '#edms=v=1&rid=1&ruc=A1&ssic=165&doc=memo'],
    ['uppercase docType', '#edms=v=1&rid=1&ruc=A1&ssic=1650&doc=BasicLetter'],
    ['missing docType', '#edms=v=1&rid=1&ruc=A1&ssic=1650'],
  ])('drops the whole payload on %s', (_label, hash) => {
    expect(parseEdmsHash(hash)).toBeNull();
  });

  // rid is optional: EDMS omits it from the New Request screen, where no
  // request row exists yet. The letter is an attachment and the EDMS
  // attachment control binds it on submit, so the ID is not needed to
  // correlate.
  it('accepts a link with no rid', () => {
    const r = parseEdmsHash('#edms=v=1&ruc=12345&ssic=1650&doc=basic');
    expect(r).not.toBeNull();
    expect(r?.requestId).toBeUndefined();
    expect(r?.ssic).toBe('1650');
  });

  // A present-but-wrong rid means the caller meant to correlate and got it
  // wrong. That is worse than not correlating, so drop the whole payload.
  it('still rejects a present but malformed rid', () => {
    expect(parseEdmsHash('#edms=v=1&rid=48a&ruc=12345&ssic=1650&doc=basic')).toBeNull();
  });

  it('drops a malformed section without losing the payload', () => {
    const r = parseEdmsHash('#edms=v=1&rid=1&ruc=A1&ssic=1650&doc=memo&sec=' + encodeURIComponent('<script>'));
    expect(r).not.toBeNull();
    expect(r?.section).toBeUndefined();
  });

  // The payload is scalar-only by design. Letter content in a URL would
  // place CUI in browser history and collapse the Low categorization in
  // docs/RMF_READINESS.md.
  it('carries no free-text field', () => {
    const r = parseEdmsHash(GOOD + '&subj=' + encodeURIComponent('ICO SGT SMITH') + '&body=text');
    expect(Object.keys(r ?? {}).sort()).toEqual(
      ['docType', 'requestId', 'ruc', 'section', 'ssic', 'version'],
    );
  });
});

describe('buildEdmsUrl', () => {
  it('round-trips through parseEdmsHash', () => {
    const ctx = { requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic', section: 'S-1' };
    const url = buildEdmsUrl('https://semperscribe.app.cloud.gov/', ctx);
    expect(url).toContain('#edms=');
    const parsed = parseEdmsHash(url.slice(url.indexOf('#')));
    expect(parsed).toMatchObject(ctx);
  });

  it('puts the payload in the fragment, never the query string', () => {
    const url = buildEdmsUrl('https://semperscribe.app.cloud.gov/', {
      requestId: '1', ruc: 'A1', ssic: '1650', docType: 'memo',
    });
    expect(url.split('#')[0]).not.toContain('rid=');
  });
});

describe('edms-mode', () => {
  beforeEach(() => {
    clearEdmsContext();
    resetEdmsCacheForTests();
    window.sessionStorage.clear();
  });

  it('is inactive by default', () => {
    expect(isEdmsMode()).toBe(false);
    expect(getEdmsContext()).toBeNull();
  });

  it('latches and survives a cache reset by reading sessionStorage', () => {
    setEdmsContext({ requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic' });
    resetEdmsCacheForTests();
    expect(isEdmsMode()).toBe(true);
    expect(getEdmsContext()?.requestId).toBe('482');
  });

  // sessionStorage, never localStorage: a stale EDMS context surviving
  // into an unrelated draft would mislabel that draft's export.
  it('writes to sessionStorage and leaves localStorage untouched', () => {
    setEdmsContext({ requestId: '9', ruc: 'A1', ssic: '1650', docType: 'memo' });
    expect(window.sessionStorage.length).toBeGreaterThan(0);
    expect(window.localStorage.length).toBe(0);
  });

  it('clears', () => {
    setEdmsContext({ requestId: '9', ruc: 'A1', ssic: '1650', docType: 'memo' });
    clearEdmsContext();
    resetEdmsCacheForTests();
    expect(isEdmsMode()).toBe(false);
  });

  it('names the only cleared provider', () => {
    expect(EDMS_ALLOWED_PROVIDER).toBe('genaimil');
  });
});

describe('edmsBaseFilename', () => {
  const ctx = { requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic' };

  it('builds the DRAFT name', () => {
    expect(edmsBaseFilename(ctx, 'DRAFT', new Date(2026, 7, 4))).toBe('SS_482_1650_20260804_basic_DRAFT');
  });

  it('builds the SIGNED name', () => {
    expect(edmsBaseFilename(ctx, 'SIGNED', new Date(2026, 7, 5))).toBe('SS_482_1650_20260805_basic_SIGNED');
  });

  it('zero-pads single-digit months and days', () => {
    expect(edmsBaseFilename(ctx, 'DRAFT', new Date(2026, 0, 9))).toContain('_20260109_');
  });

  // EDMS reads the leading request ID to warn when a Marine attaches a
  // file to the wrong request.
  it('always leads with SS_, so the flow can reject anything else', () => {
    expect(edmsBaseFilename(ctx, 'DRAFT', new Date(2026, 7, 4)).startsWith('SS_')).toBe(true);
  });

  // The EDMS guardrail tests /^\d+_/ on the filename. An SSIC is four or
  // five digits, so leading with the SSIC when no request ID exists would
  // false-warn on every SemperScribe file. This is the regression test for
  // that collision.
  it('uses NA in the request-ID slot when none exists', () => {
    const noId = { ruc: '12345', ssic: '1650', docType: 'basic' };
    const name = edmsBaseFilename(noId, 'DRAFT', new Date(2026, 7, 4));
    expect(name).toBe('SS_NA_1650_20260804_basic_DRAFT');
  });

  // Fixed segment count either way, so the flow parser never guesses.
  it('keeps the same segment count with and without a request ID', () => {
    const withId = edmsBaseFilename(ctx, 'DRAFT', new Date(2026, 7, 4)).split('_').length;
    const noId = edmsBaseFilename({ ruc: '1', ssic: '1650', docType: 'basic' }, 'DRAFT', new Date(2026, 7, 4)).split('_').length;
    expect(withId).toBe(noId);
  });
});

describe('EDMS docType contract', () => {
  // The EDMS Power App emits exactly these two values from varSSUrl /
  // varSSUrlNew. If a rename in schemas.ts breaks either, the Marine gets
  // a blank document-type selector and no error. Fail the build instead.
  it('every docType EDMS emits resolves in DOCUMENT_TYPES', async () => {
    const { DOCUMENT_TYPES } = await import('@/lib/schemas');
    for (const key of ['basic', 'endorsement']) {
      expect(DOCUMENT_TYPES[key], key + ' is missing from DOCUMENT_TYPES').toBeDefined();
    }
  });
});

/**
 * EDMS mode changes the EXPORT FILENAME, not the destination.
 *
 * The file downloads normally and the Marine attaches it through the EDMS
 * attachment control, which is what correlates it to the request. The name
 * exists so the Power App's upload guardrail can warn when a letter is
 * attached to a request it does not belong to.
 */
describe('EDMS export naming contract', () => {
  const ctx = { requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic' };

  it('produces a name the Power App guardrail recognises', () => {
    const name = edmsBaseFilename(ctx, 'DRAFT', new Date(2026, 7, 4)) + '.pdf';
    // btnUpload tests: StartsWith(raw,"SS_") and StartsWith(raw,"SS_"&ID&"_")
    expect(name.startsWith('SS_')).toBe(true);
    expect(name.startsWith('SS_482_')).toBe(true);
  });

  it('does not trip the guardrail for a request with no ID', () => {
    const name = edmsBaseFilename({ ruc: '1', ssic: '1650', docType: 'basic' }, 'DRAFT', new Date(2026, 7, 4));
    expect(name.startsWith('SS_NA_')).toBe(true);
  });

  it('a file for a different request is distinguishable by prefix alone', () => {
    const mine = edmsBaseFilename(ctx, 'DRAFT', new Date(2026, 7, 4));
    const theirs = edmsBaseFilename({ ...ctx, requestId: '481' }, 'DRAFT', new Date(2026, 7, 4));
    expect(mine.startsWith('SS_482_')).toBe(true);
    expect(theirs.startsWith('SS_482_')).toBe(false);
  });
});
