import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { streamChat } from '@/lib/gunnybot/client';
import { setEdmsContext, clearEdmsContext, resetEdmsCacheForTests } from '@/lib/edms-mode';
import type { GunnyProviderId, GunnyStreamEvent } from '@/lib/gunnybot/types';

/**
 * The EDMS egress restriction.
 *
 * streamChat is the only place GunnyBot calls fetch, so it is the only
 * place worth testing. If a commercial provider ever reaches fetch while
 * EDMS mode is active, correspondence from a DoD IL5 records workflow
 * leaves for a commercial API.
 */

function collect() {
  const events: GunnyStreamEvent[] = [];
  return { events, onEvent: (e: GunnyStreamEvent) => { events.push(e); } };
}

function req(provider: GunnyProviderId) {
  return {
    provider,
    model: 'test-model',
    apiKey: 'k',
    messages: [{ role: 'user' as const, content: 'draft a letter' }],
    maxOutputTokens: 64,
  };
}

describe('EDMS egress restriction', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearEdmsContext();
    resetEdmsCacheForTests();
    window.sessionStorage.clear();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<GunnyProviderId>(['anthropic', 'gemini'])(
    'blocks %s before any network call in EDMS mode',
    async provider => {
      setEdmsContext({ requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic-letter' });
      resetEdmsCacheForTests();
      const h = collect();
      await streamChat(req(provider), h);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(h.events).toHaveLength(1);
      expect(h.events[0].kind).toBe('error');
      expect((h.events[0] as { message: string }).message).toContain('GenAI.mil');
    },
  );

  it('lets GenAI.mil through in EDMS mode', async () => {
    setEdmsContext({ requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic-letter' });
    resetEdmsCacheForTests();
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ready' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const h = collect();
    await streamChat(req('genaimil'), h);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(h.events.some(e => e.kind === 'error' && e.message.includes('Blocked'))).toBe(false);
  });

  it('leaves commercial providers reachable outside EDMS mode', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 500 }));
    const h = collect();
    await streamChat(req('anthropic'), h);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // Fail closed. A provider the registry does not know is not a reason
  // to skip the restriction.
  it('blocks an unrecognised provider in EDMS mode', async () => {
    setEdmsContext({ requestId: '1', ruc: 'A1', ssic: '1650', docType: 'memo' });
    resetEdmsCacheForTests();
    const h = collect();
    await streamChat(req('openai'), h);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((h.events[0] as { message: string }).message).toContain('Blocked');
  });

  it('stops blocking once the EDMS context clears', async () => {
    setEdmsContext({ requestId: '1', ruc: 'A1', ssic: '1650', docType: 'memo' });
    resetEdmsCacheForTests();
    clearEdmsContext();
    resetEdmsCacheForTests();
    fetchSpy.mockResolvedValue(new Response('', { status: 500 }));
    const h = collect();
    await streamChat(req('anthropic'), h);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
