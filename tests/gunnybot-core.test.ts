/**
 * GunnyBot Phase 1 logic core (docs/GUNNYBOT_PLAN.md, docs/GUNNYBOT_PHASE0_CORS.md).
 *
 * Covers the two shippable provider adapters (Anthropic GO, Gemini
 * CONDITIONAL per Phase 0), the fetch-streaming client, the session-only
 * keyring, and the pre-send redaction gate. No network: fetch and the
 * response stream are mocked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { anthropicAdapter, geminiAdapter, genaimilAdapter, getAdapter } from '@/lib/gunnybot/providers';
import { streamChat } from '@/lib/gunnybot/client';
import * as keyring from '@/lib/gunnybot/keyring';
import { screenOutbound } from '@/lib/gunnybot/redaction';
import { buildContext } from '@/lib/gunnybot/context-builder';
import type { GunnyRequest, GunnyStreamEvent } from '@/lib/gunnybot/types';

function sseStream(full: string, size = 7): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pos >= full.length) {
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(full.slice(pos, pos + size)));
      pos += size;
    },
  });
}

const baseReq: GunnyRequest = {
  provider: 'anthropic',
  model: 'claude-opus-4-7',
  apiKey: 'sk-ant-TESTKEY0123456789',
  messages: [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: 'hi' },
  ],
  maxOutputTokens: 256,
};

const ANTHROPIC_SSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"x"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
].join('');

async function collect(req: GunnyRequest): Promise<GunnyStreamEvent[]> {
  const events: GunnyStreamEvent[] = [];
  await streamChat(req, { onEvent: e => events.push(e) });
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  keyring.clearAllKeys();
});

describe('gunnybot adapters: buildRequest', () => {
  it('builds the Anthropic request with the direct-browser header and system split out', () => {
    const http = anthropicAdapter.buildRequest(baseReq);
    const body = JSON.parse(http.body);
    expect(http.url).toBe('https://api.anthropic.com/v1/messages');
    expect(http.headers['x-api-key']).toBe(baseReq.apiKey);
    expect(http.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(http.headers['anthropic-version']).toBe('2023-06-01');
    expect(body.stream).toBe(true);
    expect(body.model).toBe('claude-opus-4-7');
    expect(body.system).toBe('SYS');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('honors a proxy base URL for Anthropic', () => {
    const http = anthropicAdapter.buildRequest({ ...baseReq, proxyBaseUrl: 'https://proxy.example' });
    expect(http.url).toBe('https://proxy.example/v1/messages');
  });

  it('builds the Gemini SSE request, key in the query, only content-type header, assistant mapped to model', () => {
    const http = geminiAdapter.buildRequest({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: 'AIzaTESTKEY0123456789ABCDEFGHIJ',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'assistant', content: 'prior' },
        { role: 'user', content: 'hi' },
      ],
      maxOutputTokens: 256,
    });
    const body = JSON.parse(http.body);
    expect(http.url).toContain(':streamGenerateContent?alt=sse&key=');
    expect(http.url).toContain('AIzaTESTKEY0123456789ABCDEFGHIJ');
    expect(Object.keys(http.headers)).toEqual(['content-type']);
    expect(body.contents[0].role).toBe('model');
    expect(body.systemInstruction.parts.text).toBe('SYS');
    expect(body.generationConfig.maxOutputTokens).toBe(256);
  });

  it('builds the GenAI.mil OpenAI-compatible request with Bearer auth and inline system turn', () => {
    const http = genaimilAdapter.buildRequest({
      provider: 'genaimil',
      model: 'gemini-2.5-flash',
      apiKey: 'STARK_TESTKEY0123456789',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'hi' },
      ],
      maxOutputTokens: 256,
    });
    const body = JSON.parse(http.body);
    expect(http.url).toBe('https://api.genai.mil/v1/chat/completions');
    expect(http.headers['authorization']).toBe('Bearer STARK_TESTKEY0123456789');
    expect(body.stream).toBe(true);
    expect(body.model).toBe('gemini-2.5-flash');
    expect(body.max_tokens).toBe(256);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
  });

  it('honors a proxy base URL for GenAI.mil', () => {
    const http = genaimilAdapter.buildRequest({
      provider: 'genaimil',
      model: 'gemini-2.5-flash',
      apiKey: 'STARK_TESTKEY0123456789',
      messages: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 16,
      proxyBaseUrl: 'https://proxy.example',
    });
    expect(http.url).toBe('https://proxy.example/v1/chat/completions');
  });
});

describe('gunnybot adapters: validateKeyShape and parseStreamChunk', () => {
  it('validates key shapes', () => {
    expect(anthropicAdapter.validateKeyShape('sk-ant-abcdefghijklmnop')).toBe(true);
    expect(anthropicAdapter.validateKeyShape('sk-openai-xxxx')).toBe(false);
    expect(geminiAdapter.validateKeyShape('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345')).toBe(true);
    expect(geminiAdapter.validateKeyShape('nope')).toBe(false);
    expect(genaimilAdapter.validateKeyShape('STARK_TESTKEY0123456789')).toBe(true);
    expect(genaimilAdapter.validateKeyShape('sk-ant-abcdefghijklmnop')).toBe(false);
  });

  it('parses GenAI.mil OpenAI-format deltas, finish_reason, [DONE], and error payloads', () => {
    const tok = genaimilAdapter.parseStreamChunk('{"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}');
    expect(tok).toEqual([{ kind: 'token', text: 'Hello' }]);
    const fin = genaimilAdapter.parseStreamChunk('{"choices":[{"delta":{},"finish_reason":"stop"}]}');
    expect(fin).toEqual([{ kind: 'done', stopReason: 'stop' }]);
    expect(genaimilAdapter.parseStreamChunk('[DONE]')).toEqual([]);
    const err = genaimilAdapter.parseStreamChunk('{"error":{"message":"key expired"}}');
    expect(err).toEqual([{ kind: 'error', message: 'key expired' }]);
  });

  it('parses Anthropic deltas, stop, and ignores ping', () => {
    const tok = anthropicAdapter.parseStreamChunk('{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}');
    expect(tok).toEqual([{ kind: 'token', text: 'Hello' }]);
    const done = anthropicAdapter.parseStreamChunk('{"type":"message_delta","delta":{"stop_reason":"end_turn"}}');
    expect(done).toEqual([{ kind: 'done', stopReason: 'end_turn' }]);
    expect(anthropicAdapter.parseStreamChunk('{"type":"ping"}')).toEqual([]);
  });

  it('parses Gemini candidate text and finishReason', () => {
    expect(geminiAdapter.parseStreamChunk('{"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}')).toEqual([
      { kind: 'token', text: 'Hi' },
    ]);
    const withFin = geminiAdapter.parseStreamChunk('{"candidates":[{"content":{"parts":[{"text":"x"}]},"finishReason":"STOP"}]}');
    expect(withFin[withFin.length - 1]).toEqual({ kind: 'done', stopReason: 'STOP' });
  });
});

describe('gunnybot registry', () => {
  it('exposes Anthropic, Gemini, and GenAI.mil, leaves OpenAI and Azure null', () => {
    expect(getAdapter('anthropic')).toBe(anthropicAdapter);
    expect(getAdapter('gemini')).toBe(geminiAdapter);
    expect(getAdapter('genaimil')).toBe(genaimilAdapter);
    expect(getAdapter('openai')).toBeNull();
    expect(getAdapter('azure')).toBeNull();
  });
});

describe('gunnybot client: streaming', () => {
  it('assembles tokens across chunk boundaries and emits one done', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, body: sseStream(ANTHROPIC_SSE), text: async () => '' })),
    );
    const events = await collect(baseReq);
    const text = events.filter(e => e.kind === 'token').map(e => (e as { text: string }).text).join('');
    const dones = events.filter(e => e.kind === 'done');
    expect(text).toBe('Hello world');
    expect(dones).toHaveLength(1);
    expect((dones[0] as { stopReason: string | null }).stopReason).toBe('end_turn');
  });

  it('summarizes a non-ok response with a short reason and redacts the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        body: null,
        text: async () => JSON.stringify({ error: { message: 'invalid key sk-ant-TESTKEY0123456789', status: 'UNAUTHENTICATED' } }),
      })),
    );
    const events = await collect(baseReq);
    const err = events.find(e => e.kind === 'error') as { message: string } | undefined;
    expect(err).toBeDefined();
    expect(err!.message).toContain('API key invalid or not authorized');
    expect(err!.message).toContain('HTTP 401');
    expect(err!.message).not.toContain('sk-ant-TESTKEY0123456789');
    expect(err!.message).toContain('[redacted-key]');
  });

  it('labels a Google 400 API_KEY_INVALID and a 429 quota clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        body: null,
        text: async () =>
          JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }),
      })),
    );
    const e1 = (await collect(baseReq)).find(e => e.kind === 'error') as { message: string };
    expect(e1.message).toContain('API key invalid or not authorized');
    expect(e1.message).toContain('API key not valid');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        body: null,
        text: async () => JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED' } }),
      })),
    );
    const e2 = (await collect(baseReq)).find(e => e.kind === 'error') as { message: string };
    expect(e2.message).toContain('Rate limit or quota exceeded');
    expect(e2.message).toContain('HTTP 429');
  });

  it('reports a clean done when the fetch aborts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        throw e;
      }),
    );
    const events = await collect(baseReq);
    expect(events).toEqual([{ kind: 'done', stopReason: 'aborted' }]);
  });

  it('errors clearly when the provider has no browser-direct adapter', async () => {
    const events = await collect({ ...baseReq, provider: 'openai' });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('error');
  });
});

describe('gunnybot keyring: session only', () => {
  it('stores in sessionStorage and never in localStorage', () => {
    const lsSpy = vi.spyOn(window.localStorage, 'setItem');
    keyring.setKey('anthropic', 'k1');
    expect(keyring.getKey('anthropic')).toBe('k1');
    expect(keyring.hasKey('anthropic')).toBe(true);
    expect(window.sessionStorage.getItem('gunnybot-key-anthropic')).toBe('k1');
    expect(window.localStorage.getItem('gunnybot-key-anthropic')).toBeNull();
    expect(lsSpy).not.toHaveBeenCalled();
    keyring.clearKey('anthropic');
    expect(keyring.getKey('anthropic')).toBeNull();
    expect(window.sessionStorage.getItem('gunnybot-key-anthropic')).toBeNull();
  });
});

describe('gunnybot redaction: pre-send gate', () => {
  it('blocks an EDIPI and passes clean text', () => {
    const flagged = screenOutbound('member EDIPI 1234567890 attached');
    expect(flagged.blocked).toBe(true);
    expect(flagged.findings.length).toBeGreaterThan(0);
    expect(screenOutbound('This is a clean unclassified draft paragraph.').blocked).toBe(false);
  });
});

describe('gunnybot context-builder: egress surface', () => {
  it('includes documentType, subject, and body for a proofread', () => {
    const ctx = buildContext({ task: 'proofread', documentType: 'basic', subject: 'TEST', body: 'para one' });
    expect(ctx.task).toBe('proofread');
    expect(ctx.text).toContain('Document type: basic');
    expect(ctx.text).toContain('Subject: TEST');
    expect(ctx.text).toContain('Draft:\npara one');
  });

  it('omits empty subject and body, keeps a question', () => {
    const ctx = buildContext({ task: 'qa', documentType: 'mco', subject: '', body: '', question: 'why' });
    expect(ctx.text).toContain('Question: why');
    expect(ctx.text).not.toContain('Subject:');
    expect(ctx.text).not.toContain('Draft:');
  });
});

describe('gunnybot genaimil adapter (OpenAI-compatible)', () => {
  it('builds a bearer-auth chat-completions request keeping system in messages', () => {
    const http = genaimilAdapter.buildRequest({
      provider: 'genaimil',
      model: 'gemini-2.5-flash',
      apiKey: 'STARK_TESTKEY0123456789',
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'hi' },
      ],
      maxOutputTokens: 128,
    });
    const body = JSON.parse(http.body);
    expect(http.url).toBe('https://api.genai.mil/v1/chat/completions');
    expect(http.headers['authorization']).toBe('Bearer STARK_TESTKEY0123456789');
    expect(body.stream).toBe(false);
    expect(body.max_tokens).toBe(128);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
  });

  it('honors a proxy base URL', () => {
    const http = genaimilAdapter.buildRequest({
      provider: 'genaimil',
      model: 'x',
      apiKey: 'STARK_TESTKEY0123456789',
      messages: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 16,
      proxyBaseUrl: 'https://proxy.example',
    });
    expect(http.url).toBe('https://proxy.example/v1/chat/completions');
  });

  it('parses OpenAI-style delta content and finish_reason, ignores [DONE]', () => {
    expect(genaimilAdapter.parseStreamChunk('{"choices":[{"delta":{"content":"Hi"}}]}')).toEqual([{ kind: 'token', text: 'Hi' }]);
    expect(genaimilAdapter.parseStreamChunk('{"choices":[{"delta":{},"finish_reason":"stop"}]}')).toEqual([{ kind: 'done', stopReason: 'stop' }]);
    expect(genaimilAdapter.parseStreamChunk('[DONE]')).toEqual([]);
  });

  it('is non-streaming and parses a full JSON response', () => {
    expect(genaimilAdapter.streaming).toBe(false);
    const events = genaimilAdapter.parseFullResponse!({ choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }] });
    expect(events).toEqual([{ kind: 'token', text: 'Hello' }, { kind: 'done', stopReason: 'stop' }]);
  });

  it('streamChat reads a non-streaming GenAI.mil response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'ready' }, finish_reason: 'stop' }] }),
        text: async () => '',
      })),
    );
    const events: GunnyStreamEvent[] = [];
    await streamChat(
      { provider: 'genaimil', model: 'gemini-2.5-flash', apiKey: 'STARK_TESTKEY0123456789', messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 64 },
      { onEvent: e => events.push(e) },
    );
    expect(events.filter(e => e.kind === 'token').map(e => (e as { text: string }).text).join('')).toBe('ready');
    expect(events.some(e => e.kind === 'done')).toBe(true);
  });
});
