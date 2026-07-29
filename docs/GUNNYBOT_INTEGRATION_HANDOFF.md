# GunnyBot Integration Handoff

Audience: an implementing LLM/coding agent adding GunnyBot to another web app.
Source of truth: this document. Every file below is verbatim from the working SemperScribe build (typechecked strict, 19 vitest cases green).
Goal: drop a bring-your-own-key, session-only, streaming, multi-provider LLM assistant into a target app with minimal coupling.

---

## 0. TL;DR

1. Copy the eight core files in Section 4 into `src/lib/gunnybot/`. They are framework-agnostic TypeScript, only Web APIs (`fetch`, `TextDecoder`, `AbortController`, `sessionStorage`). No SDKs.
2. Add the state layer (Section 6) and the UI surfaces you want (Section 7). The core does not depend on the UI.
3. Read Section 3 (CORS reality) before promising any provider works in a browser. A static or client-only app can reach Anthropic and (conditionally) Gemini directly. OpenAI and Azure need a proxy. `.mil` endpoints are unverified.
4. Obey Section 8 (security and compliance) exactly. The key is session-only, never localStorage, never committed, and the app must disclose the egress in its privacy or security copy.

The mental model: `streamChat(request, handlers)` is the only entry point. It looks up a provider adapter, builds one HTTP request, streams the SSE response, and emits `{kind:'token'|'done'|'error'}` events. Everything else is UI.

---

## 1. What GunnyBot is

- A client-side assistant. The user pastes their own provider API key. The browser calls the provider directly. There is no backend and no shared secret.
- Streaming. Responses render token by token. A Stop control aborts mid-stream.
- Multi-provider behind one interface. Adding a provider is one adapter object plus one registry line.
- Non-destructive. In the host app, every assistant suggestion is a proposal the user accepts or rejects. GunnyBot never writes app state on its own. Preserve this rule.

Capabilities SemperScribe wired (each is just a different system prompt plus a different UI surface, all through `streamChat`):
- Q&A chat (content-free by default: only the typed question leaves).
- Proofread review (sends the document body, advisory output).
- Per-item rewrite (sends one item, proposes a replacement).
- Draft generation (prompt in, new item out on accept).

---

## 2. Hard constraints (read before designing)

- No backend assumed. The app is a static export or client-only SPA. The key lives in the browser and calls go direct to the provider.
- CORS is per provider and decides feasibility. See Section 3.
- Model IDs churn. Never hardcode a single model. Provide a short default list and a free-text custom-model field.
- The key must never be persisted to disk, logged, committed, or embedded in code. Session memory only.
- Errors must never leak the key. The client redacts it from every error path.

---

## 3. Provider CORS reality (feasibility, not opinion)

A browser can only call a provider that returns permissive CORS headers to the app origin. Verdict from live testing and provider docs, July 2026:

| Provider | Browser-direct | How | Notes |
|----------|----------------|-----|-------|
| Anthropic | YES | header `anthropic-dangerous-direct-browser-access: true` plus `x-api-key`, `anthropic-version` | BYO-key is the endorsed use. Clean. |
| Google Gemini | CONDITIONAL | REST `:streamGenerateContent?alt=sse&key=...`, only `content-type` header | Works in practice from a browser (confirmed from localhost). Google discourages client-side keys. Keep custom headers off to pass preflight. Free tier: use `gemini-2.5-flash`; `gemini-2.5-pro` free-tier limit is often 0. |
| GenAI.mil (DoD) | UNVERIFIED | OpenAI-compatible, `Authorization: Bearer`, `POST /v1/chat/completions` | Government endpoint. May refuse the browser origin or be network-gated. Confirm with a live Test connection. Fall back to `proxyBaseUrl`. |
| OpenAI | NO | CORS blocked/inconsistent for `api.openai.com` | The SDK `dangerouslyAllowBrowser` flag does NOT add CORS headers. Needs a proxy. |
| Azure OpenAI | NO | endpoints return no CORS headers | Needs a backend or an APIM proxy the user configures. |

The escape hatch: every adapter accepts `req.proxyBaseUrl`. When set, the request goes to the user's own CORS-passthrough proxy (a small Cloudflare Worker or Cloud Run service that forwards to the provider) instead of the provider host. This keeps the app backend-free while unblocking OpenAI, Azure, or a gated GenAI.mil. Expose a per-provider proxy URL field in Settings when you need it.

If your target app has a backend, the cleaner path is to route all provider calls through your own server (which holds the key) and skip the browser-CORS problem entirely. In that case, move `streamChat` to the server and stream to the client over your own SSE or WebSocket. The adapters (buildRequest / parseStreamChunk) port unchanged.

---

## 4. The portable core (copy verbatim into `src/lib/gunnybot/`)

Eight files. Dependencies: none beyond the DOM/Web platform, except `redaction.ts` which imports a sensitive-data scanner (Section 5 gives a standalone version). If you do not want the redaction gate, skip `redaction.ts` and drop its line from `index.ts`.

### `src/lib/gunnybot/types.ts`

```ts
export type GunnyProviderId = 'anthropic' | 'gemini' | 'genaimil' | 'openai' | 'azure';

export type GunnyTask = 'proofread' | 'draft' | 'rewrite' | 'qa';

export type GunnyRole = 'system' | 'user' | 'assistant';

export interface GunnyModel {
  id: string;
  label: string;
  contextWindow: number;
}

export interface GunnyMessage {
  role: GunnyRole;
  content: string;
}

export interface GunnyRequest {
  provider: GunnyProviderId;
  model: string;
  apiKey: string;
  messages: GunnyMessage[];
  maxOutputTokens: number;
  // Optional user-supplied proxy base URL for providers blocked on
  // direct browser CORS (OpenAI, Azure).
  proxyBaseUrl?: string;
}

export type GunnyStreamEvent =
  | { kind: 'token'; text: string }
  | { kind: 'done'; stopReason: string | null }
  | { kind: 'error'; message: string };

export interface GunnyHttpRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface ProviderAdapter {
  id: GunnyProviderId;
  label: string;
  models: GunnyModel[];
  browserDirect: boolean;
  validateKeyShape(key: string): boolean;
  buildRequest(req: GunnyRequest): GunnyHttpRequest;
  parseStreamChunk(raw: string): GunnyStreamEvent[];
}
```

### `src/lib/gunnybot/providers.ts`

```ts
import type {
  GunnyRequest,
  GunnyHttpRequest,
  GunnyStreamEvent,
  ProviderAdapter,
  GunnyModel,
  GunnyProviderId,
} from './types';

// Model IDs churn. These are current defaults (July 2026). The UI also
// accepts a custom model string. The provider Models API is the truth.
const ANTHROPIC_MODELS: GunnyModel[] = [
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', contextWindow: 1000000 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextWindow: 1000000 },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', contextWindow: 200000 },
];

const GEMINI_MODELS: GunnyModel[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextWindow: 1000000 },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextWindow: 1000000 },
];

const GENAIMIL_MODELS: GunnyModel[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextWindow: 1000000 },
];

const ANTHROPIC_HOST = 'https://api.anthropic.com';
const GEMINI_HOST = 'https://generativelanguage.googleapis.com';
const GENAIMIL_HOST = 'https://api.genai.mil';

interface AnthropicBody {
  model: string;
  max_tokens: number;
  messages: { role: string; content: string }[];
  stream: boolean;
  system?: string;
}

interface GeminiContent {
  role: string;
  parts: { text: string }[];
}

interface GeminiBody {
  contents: GeminiContent[];
  generationConfig: { maxOutputTokens: number };
  systemInstruction?: { parts: { text: string } };
}

interface OpenAICompatibleBody {
  model: string;
  messages: { role: string; content: string }[];
  stream: boolean;
  max_tokens: number;
}

function joinSystem(req: GunnyRequest): string {
  return req.messages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');
}

// Anthropic: browser-direct GO.
export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  label: 'Anthropic',
  models: ANTHROPIC_MODELS,
  browserDirect: true,

  validateKeyShape(key: string): boolean {
    return key.startsWith('sk-ant-') && key.length > 20;
  },

  buildRequest(req: GunnyRequest): GunnyHttpRequest {
    const system = joinSystem(req);
    const turns = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));
    const body: AnthropicBody = {
      model: req.model,
      max_tokens: req.maxOutputTokens,
      messages: turns,
      stream: true,
    };
    if (system.length > 0) {
      body.system = system;
    }
    const host = req.proxyBaseUrl ?? ANTHROPIC_HOST;
    return {
      url: host + '/v1/messages',
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    };
  },

  parseStreamChunk(raw: string): GunnyStreamEvent[] {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return [];
    }
    let json: any;
    try {
      json = JSON.parse(trimmed);
    } catch {
      return [];
    }
    const type = json.type;
    if (type === 'content_block_delta' && json.delta?.type === 'text_delta') {
      return [{ kind: 'token', text: String(json.delta.text ?? '') }];
    }
    if (type === 'message_delta' && json.delta?.stop_reason) {
      return [{ kind: 'done', stopReason: String(json.delta.stop_reason) }];
    }
    if (type === 'error') {
      return [{ kind: 'error', message: String(json.error?.message ?? 'stream error') }];
    }
    return [];
  },
};

// Gemini: browser-direct CONDITIONAL. Key in the query string, only
// content-type header, to keep the CORS preflight minimal.
export const geminiAdapter: ProviderAdapter = {
  id: 'gemini',
  label: 'Google Gemini',
  models: GEMINI_MODELS,
  browserDirect: true,

  validateKeyShape(key: string): boolean {
    return key.startsWith('AIza') && key.length >= 30;
  },

  buildRequest(req: GunnyRequest): GunnyHttpRequest {
    const system = joinSystem(req);
    const contents: GeminiContent[] = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const body: GeminiBody = {
      contents,
      generationConfig: { maxOutputTokens: req.maxOutputTokens },
    };
    if (system.length > 0) {
      body.systemInstruction = { parts: { text: system } };
    }
    const host = req.proxyBaseUrl ?? GEMINI_HOST;
    const url =
      host +
      '/v1beta/models/' +
      req.model +
      ':streamGenerateContent?alt=sse&key=' +
      encodeURIComponent(req.apiKey);
    return {
      url,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    };
  },

  parseStreamChunk(raw: string): GunnyStreamEvent[] {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed === '[DONE]') {
      return [];
    }
    let json: any;
    try {
      json = JSON.parse(trimmed);
    } catch {
      return [];
    }
    const events: GunnyStreamEvent[] = [];
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.length > 0) {
          events.push({ kind: 'token', text: part.text });
        }
      }
    }
    if (candidate?.finishReason) {
      events.push({ kind: 'done', stopReason: String(candidate.finishReason) });
    }
    return events;
  },
};

// GenAI.mil: DoD GenAI gateway. OpenAI-compatible. Browser-direct reach
// unverified. Use proxyBaseUrl if the endpoint refuses the origin.
export const genaimilAdapter: ProviderAdapter = {
  id: 'genaimil',
  label: 'GenAI.mil',
  models: GENAIMIL_MODELS,
  browserDirect: true,

  validateKeyShape(key: string): boolean {
    return key.trim().length > 20;
  },

  buildRequest(req: GunnyRequest): GunnyHttpRequest {
    const body: OpenAICompatibleBody = {
      model: req.model,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: req.maxOutputTokens,
    };
    const host = req.proxyBaseUrl ?? GENAIMIL_HOST;
    return {
      url: host + '/v1/chat/completions',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + req.apiKey,
      },
      body: JSON.stringify(body),
    };
  },

  parseStreamChunk(raw: string): GunnyStreamEvent[] {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed === '[DONE]') {
      return [];
    }
    let json: any;
    try {
      json = JSON.parse(trimmed);
    } catch {
      return [];
    }
    const choice = json.choices?.[0];
    const events: GunnyStreamEvent[] = [];
    const content = choice?.delta?.content;
    if (typeof content === 'string' && content.length > 0) {
      events.push({ kind: 'token', text: content });
    }
    if (choice?.finish_reason) {
      events.push({ kind: 'done', stopReason: String(choice.finish_reason) });
    }
    return events;
  },
};

// OpenAI and Azure are null until a proxy path ships. To enable them,
// build an OpenAI-compatible adapter like genaimilAdapter with the right
// host and require proxyBaseUrl.
export const PROVIDER_REGISTRY: Record<GunnyProviderId, ProviderAdapter | null> = {
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  genaimil: genaimilAdapter,
  openai: null,
  azure: null,
};

export function getAdapter(id: GunnyProviderId): ProviderAdapter | null {
  return PROVIDER_REGISTRY[id];
}
```

### `src/lib/gunnybot/client.ts`

```ts
import type { GunnyRequest, GunnyStreamEvent } from './types';
import { getAdapter } from './providers';

export interface StreamHandlers {
  onEvent(event: GunnyStreamEvent): void;
  signal?: AbortSignal;
}

// Single entry point for a chat turn. Sends the adapter-built request,
// frames the SSE response, emits events. Stop rides the AbortSignal. The
// key never appears in an emitted error.
export async function streamChat(req: GunnyRequest, handlers: StreamHandlers): Promise<void> {
  const adapter = getAdapter(req.provider);
  if (adapter === null) {
    handlers.onEvent({
      kind: 'error',
      message: 'Provider ' + req.provider + ' has no browser-direct adapter. Configure a proxy first.',
    });
    return;
  }

  const httpReq = adapter.buildRequest(req);

  let res: Response;
  try {
    res = await fetch(httpReq.url, {
      method: 'POST',
      headers: httpReq.headers,
      body: httpReq.body,
      signal: handlers.signal,
    });
  } catch (err) {
    if (isAbort(err)) {
      handlers.onEvent({ kind: 'done', stopReason: 'aborted' });
      return;
    }
    handlers.onEvent({ kind: 'error', message: safeError(err, req.apiKey) });
    return;
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    handlers.onEvent({ kind: 'error', message: summarizeHttpError(res.status, detail, req.apiKey) });
    return;
  }

  const body = res.body;
  if (!body) {
    handlers.onEvent({ kind: 'error', message: 'Provider returned no response stream.' });
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r/g, '');
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        emitBlock(adapter, block, handlers);
        sep = buffer.indexOf('\n\n');
      }
    }
    if (buffer.length > 0) {
      emitBlock(adapter, buffer, handlers);
    }
  } catch (err) {
    if (isAbort(err)) {
      handlers.onEvent({ kind: 'done', stopReason: 'aborted' });
      return;
    }
    handlers.onEvent({ kind: 'error', message: safeError(err, req.apiKey) });
  }
}

function emitBlock(
  adapter: { parseStreamChunk(raw: string): GunnyStreamEvent[] },
  block: string,
  handlers: StreamHandlers,
): void {
  const data = extractSseData(block);
  if (data === null) {
    return;
  }
  const events = adapter.parseStreamChunk(data);
  for (const event of events) {
    handlers.onEvent(event);
  }
}

function extractSseData(block: string): string | null {
  const lines = block.split('\n');
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const value = line.slice(5);
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return dataLines.join('\n');
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

function redact(text: string, key: string): string {
  if (key.length === 0) {
    return text;
  }
  return text.split(key).join('[redacted-key]');
}

function safeError(err: unknown, key: string): string {
  const raw =
    typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : String(err);
  const redacted = redact(raw, key);
  const lower = redacted.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'Could not reach the provider. This is usually a network block or a CORS restriction. (' + redacted + ')';
  }
  return redacted;
}

function summarizeHttpError(status: number, body: string, key: string): string {
  const redacted = redact(body, key);
  let providerMessage = '';
  let reason = '';
  try {
    const json = JSON.parse(redacted);
    const err = json?.error ?? json;
    if (typeof err?.message === 'string') {
      providerMessage = err.message;
    }
    if (typeof err?.status === 'string') {
      reason = err.status;
    }
    const details = err?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d && typeof d.reason === 'string') {
          reason = d.reason;
          break;
        }
      }
    }
    if (reason.length === 0 && typeof err?.type === 'string') {
      reason = err.type;
    }
  } catch {
    // Body is not JSON. The status label carries the message.
  }
  const label = shortLabel(status, reason + ' ' + providerMessage);
  const detail = providerMessage.length > 0 ? '. ' + truncate(providerMessage, 240) : '';
  return label + ' (HTTP ' + status + ')' + detail;
}

function shortLabel(status: number, hint: string): string {
  const h = hint.toLowerCase();
  if (
    h.includes('api_key_invalid') ||
    h.includes('api key not valid') ||
    h.includes('invalid api key') ||
    h.includes('unauthenticated') ||
    status === 401 ||
    status === 403
  ) {
    return 'API key invalid or not authorized';
  }
  if (h.includes('quota') || h.includes('rate limit') || h.includes('rate_limit') || status === 429) {
    return 'Rate limit or quota exceeded';
  }
  if (h.includes('model') && (h.includes('not found') || h.includes('does not exist') || h.includes('permission'))) {
    return 'Model not available for this key';
  }
  if (status === 404) {
    return 'Not found';
  }
  if (status === 400) {
    return 'Bad request, check the model ID and key';
  }
  if (status >= 500) {
    return 'Provider server error';
  }
  return 'Request failed';
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}
```

### `src/lib/gunnybot/keyring.ts`

```ts
import type { GunnyProviderId } from './types';

// Session-only API key store. Keys live in memory and mirror to
// sessionStorage so a reload inside the same tab keeps them. Nothing
// touches localStorage. Everything clears when the tab closes.

const memoryKeys = new Map<GunnyProviderId, string>();
const STORAGE_PREFIX = 'gunnybot-key-';

function storageKey(provider: GunnyProviderId): string {
  return STORAGE_PREFIX + provider;
}

function hasSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function setKey(provider: GunnyProviderId, key: string): void {
  memoryKeys.set(provider, key);
  if (hasSessionStorage()) {
    try {
      sessionStorage.setItem(storageKey(provider), key);
    } catch {
      // Fall back to memory only.
    }
  }
}

export function getKey(provider: GunnyProviderId): string | null {
  const inMemory = memoryKeys.get(provider);
  if (inMemory !== undefined) {
    return inMemory;
  }
  if (hasSessionStorage()) {
    try {
      const stored = sessionStorage.getItem(storageKey(provider));
      if (stored !== null) {
        memoryKeys.set(provider, stored);
        return stored;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function hasKey(provider: GunnyProviderId): boolean {
  return getKey(provider) !== null;
}

export function clearKey(provider: GunnyProviderId): void {
  memoryKeys.delete(provider);
  if (hasSessionStorage()) {
    try {
      sessionStorage.removeItem(storageKey(provider));
    } catch {
      // Memory is already cleared.
    }
  }
}

export function clearAllKeys(): void {
  const providers = Array.from(memoryKeys.keys());
  for (const provider of providers) {
    clearKey(provider);
  }
}
```

### `src/lib/gunnybot/prompts.ts`

Rewrite `GUARDRAILS` and `TASK_PROMPTS` for the target app's domain. This is the only file that carries SemperScribe-specific wording.

```ts
import type { GunnyTask } from './types';

const GUARDRAILS =
  'You are GunnyBot, a drafting aide for USMC correspondence. ' +
  'Give advisory help only. Never invent policy citations. ' +
  'Never generate a signature or attribute content to a named real official. ' +
  'Flag anything the user should verify against the source publication.';

const TASK_PROMPTS: Record<GunnyTask, string> = {
  qa: 'Answer questions about naval correspondence format and policy using only the reference text provided. Label every answer advisory.',
  proofread: 'Review the draft for tone, clarity, and grammar. Report findings as a list. Do not rewrite the whole document.',
  rewrite: 'Rewrite the selected text in naval correspondence voice. Return only the rewritten text.',
  draft: 'Draft or expand the requested paragraph from the prompt and context. Return only the new paragraph.',
};

export function getSystemPrompt(task: GunnyTask): string {
  return GUARDRAILS + '\n\n' + TASK_PROMPTS[task];
}
```

### `src/lib/gunnybot/context-builder.ts`

This is the auditable egress surface. Only the fields listed here leave the browser. Adjust the field set to the target app, keep the principle: one place that defines exactly what is sent.

```ts
import type { GunnyTask } from './types';

export interface GunnyContextInput {
  task: GunnyTask;
  documentType: string;
  subject: string;
  body: string;
  question?: string;
}

export interface GunnyContext {
  task: GunnyTask;
  text: string;
}

export function buildContext(input: GunnyContextInput): GunnyContext {
  const parts: string[] = [];
  parts.push('Document type: ' + input.documentType);
  if (input.subject.trim().length > 0) {
    parts.push('Subject: ' + input.subject.trim());
  }
  if (input.question && input.question.trim().length > 0) {
    parts.push('Question: ' + input.question.trim());
  }
  if (input.body.trim().length > 0) {
    parts.push('Draft:\n' + input.body.trim());
  }
  return { task: input.task, text: parts.join('\n\n') };
}
```

### `src/lib/gunnybot/redaction.ts` (optional)

Pre-send scan. In SemperScribe it imports the host app's scanner. Section 5 gives a standalone version so this is drop-in. Optional: SemperScribe built it but does not wire it as a hard block. Use it as a warn or a block before sending content.

```ts
import { scanForSensitiveData } from './security-scan';
import type { SecurityScanResult } from './security-scan';

export interface RedactionVerdict {
  blocked: boolean;
  findings: string[];
  scan: SecurityScanResult;
}

export function screenOutbound(payload: string): RedactionVerdict {
  const scan = scanForSensitiveData(payload);
  const findings = [...scan.piiMatches, ...scan.phiMatches];
  return {
    blocked: scan.hasPII || scan.hasPHI,
    findings,
    scan,
  };
}
```

### `src/lib/gunnybot/index.ts`

```ts
export type {
  GunnyProviderId,
  GunnyTask,
  GunnyRole,
  GunnyModel,
  GunnyMessage,
  GunnyRequest,
  GunnyStreamEvent,
  GunnyHttpRequest,
  ProviderAdapter,
} from './types';

export { PROVIDER_REGISTRY, getAdapter, anthropicAdapter, geminiAdapter, genaimilAdapter } from './providers';
export { setKey, getKey, hasKey, clearKey, clearAllKeys } from './keyring';
export { screenOutbound } from './redaction';
export type { RedactionVerdict } from './redaction';
export { getSystemPrompt } from './prompts';
export { buildContext } from './context-builder';
export type { GunnyContextInput, GunnyContext } from './context-builder';
export { streamChat } from './client';
export type { StreamHandlers } from './client';
```

---

## 5. Standalone sensitive-data scanner (for `redaction.ts`)

Create `src/lib/gunnybot/security-scan.ts` so `redaction.ts` has no host dependency. Extend the patterns per the target domain.

```ts
export interface SecurityScanResult {
  hasPII: boolean;
  hasPHI: boolean;
  piiMatches: string[];
  phiMatches: string[];
}

const SSN = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/;
const EDIPI = /\b\d{10}\b/;
const PHI_KEYWORDS = [
  'medical', 'health', 'diagnosis', 'prognosis', 'treatment', 'clinic',
  'hospital', 'patient', 'medication', 'prescription', 'surgery',
];

export function scanForSensitiveData(data: unknown): SecurityScanResult {
  const raw = JSON.stringify(data);
  const lower = raw.toLowerCase();
  const result: SecurityScanResult = { hasPII: false, hasPHI: false, piiMatches: [], phiMatches: [] };
  if (SSN.test(raw)) { result.hasPII = true; result.piiMatches.push('Possible SSN detected'); }
  if (EDIPI.test(raw)) { result.hasPII = true; result.piiMatches.push('Possible 10-digit ID detected'); }
  for (const kw of PHI_KEYWORDS) {
    if (lower.includes(kw)) { result.hasPHI = true; if (!result.phiMatches.includes(kw)) result.phiMatches.push(kw); }
  }
  return result;
}
```

---

## 6. State layer (zustand reference, swappable)

The core does not require zustand. Any state container works. Keep the key OUT of the store (it lives in the keyring). The store holds selection and UI flags only.

```ts
// src/store/gunnyStore.ts
import { create } from 'zustand';
import type { GunnyProviderId, GunnyMessage } from '@/lib/gunnybot/types';

interface GunnyState {
  panelOpen: boolean;
  provider: GunnyProviderId;
  model: string;
  keyPresent: boolean;
  streaming: boolean;
  messages: GunnyMessage[];
  setPanelOpen: (open: boolean) => void;
  setProvider: (provider: GunnyProviderId) => void;
  setModel: (model: string) => void;
  setKeyPresent: (present: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  addMessage: (message: GunnyMessage) => void;
  appendToLast: (text: string) => void;
  resetConversation: () => void;
}

const DEFAULT_MODEL = 'claude-opus-4-7';

export const useGunnyStore = create<GunnyState>((set) => ({
  panelOpen: false,
  provider: 'anthropic',
  model: DEFAULT_MODEL,
  keyPresent: false,
  streaming: false,
  messages: [],
  setPanelOpen: (open) => set({ panelOpen: open }),
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setKeyPresent: (present) => set({ keyPresent: present }),
  setStreaming: (streaming) => set({ streaming }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  appendToLast: (text) => set((s) => {
    if (s.messages.length === 0) return s;
    const next = s.messages.slice();
    const last = next[next.length - 1];
    next[next.length - 1] = { role: last.role, content: last.content + text };
    return { messages: next };
  }),
  resetConversation: () => set({ messages: [] }),
}));
```

---

## 7. UI integration (React reference)

The UI is the only framework-specific part. SemperScribe uses React plus a shadcn/radix component kit. Below are the patterns. Replace `Button`, `Input`, `Select`, `Textarea` with the target app's primitives, or plain HTML elements. Keep the logic.

### 7a. Settings panel (key, provider, model, test connection)

```tsx
// Minimal logic, swap the elements for your design system.
import { useState } from 'react';
import { useGunnyStore } from '@/store/gunnyStore';
import { getAdapter } from '@/lib/gunnybot/providers';
import { streamChat } from '@/lib/gunnybot/client';
import { setKey as saveKey, clearKey, getKey } from '@/lib/gunnybot/keyring';
import type { GunnyProviderId } from '@/lib/gunnybot/types';

export function GunnyBotSettings() {
  const { provider, model, keyPresent, setProvider, setModel, setKeyPresent } = useGunnyStore();
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const adapter = getAdapter(provider);
  const models = adapter?.models ?? [];

  const onProvider = (value: string) => {
    const next = value as GunnyProviderId;
    setProvider(next);
    const first = getAdapter(next)?.models[0]?.id;
    if (first) setModel(first);
    setKeyPresent(getKey(next) !== null);
  };

  const onSave = () => {
    const k = keyInput.trim();
    if (!k) return;
    saveKey(provider, k);          // session-only keyring
    setKeyPresent(true);
    setKeyInput('');
  };

  const onTest = async () => {
    const key = getKey(provider);
    if (!key) { setStatus('No key set'); return; }
    setTesting(true);
    let ok = false; let err = '';
    await streamChat(
      { provider, model, apiKey: key, messages: [{ role: 'user', content: 'Reply with: ready' }], maxOutputTokens: 16 },
      { onEvent: (e) => { if (e.kind === 'token' || e.kind === 'done') ok = true; if (e.kind === 'error') err = e.message; } },
    );
    setTesting(false);
    setStatus(ok && !err ? 'Connection good' : ('Failed: ' + (err || 'no response')));
  };

  return (
    <div>
      <label>Provider</label>
      <select value={provider} onChange={(e) => onProvider(e.target.value)}>
        <option value="anthropic">Anthropic</option>
        <option value="gemini">Google Gemini</option>
        <option value="genaimil">GenAI.mil</option>
        {/* openai, azure disabled until you add a proxy path */}
      </select>

      <label>Model</label>
      <select value={models.some(m => m.id === model) ? model : ''} onChange={(e) => setModel(e.target.value)}>
        {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="or type a model ID" />

      <label>API key</label>
      <input type="password" autoComplete="off" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
      <button onClick={onSave} disabled={!keyInput.trim()}>Save</button>
      {keyPresent && <button onClick={() => { clearKey(provider); setKeyPresent(false); }}>Clear</button>}
      <button onClick={onTest} disabled={!keyPresent || testing}>Test connection</button>
      <p>{status}</p>

      <p>What you send leaves your browser and goes to your chosen provider under your key.
         Do not enter CUI, PII, or classified text.</p>
    </div>
  );
}
```

### 7b. Streaming a turn (the universal pattern)

Every feature is this shape. Content-free Q&A sends only the question. Content-aware features send `buildContext(...)`.

```tsx
import { useRef, useState } from 'react';
import { useGunnyStore } from '@/store/gunnyStore';
import { streamChat } from '@/lib/gunnybot/client';
import { getSystemPrompt } from '@/lib/gunnybot/prompts';
import { getKey } from '@/lib/gunnybot/keyring';
import type { GunnyMessage } from '@/lib/gunnybot/types';

function useGunnyRun() {
  const { provider, model } = useGunnyStore();
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async (task: 'qa' | 'proofread' | 'rewrite' | 'draft', userText: string) => {
    const key = getKey(provider);
    if (!key) { setOutput('Add your API key in Settings.'); return; }
    setOutput('');
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const messages: GunnyMessage[] = [
      { role: 'system', content: getSystemPrompt(task) },
      { role: 'user', content: userText },
    ];
    await streamChat(
      { provider, model, apiKey: key, messages, maxOutputTokens: 1024 },
      {
        signal: controller.signal,
        onEvent: (e) => {
          if (e.kind === 'token') setOutput(prev => prev + e.text);
          else if (e.kind === 'error') setOutput(prev => prev + '\n[error] ' + e.message);
        },
      },
    );
    setStreaming(false);
  };

  const stop = () => abortRef.current?.abort();
  return { output, streaming, run, stop };
}
```

For content-aware tasks, build `userText` with `buildContext({ task, documentType, subject, body, question })` instead of raw text. For proposals (rewrite, draft), render `output` in a card with Accept and Reject; on Accept, call the host app's own update function. Never write host state directly from GunnyBot.

### 7c. Surfaces SemperScribe shipped (map to your app)

- A header button that toggles `panelOpen`, plus a slide-out panel holding the Q&A chat.
- A settings tab holding `GunnyBotSettings`.
- A per-item control (rewrite): sends one item's text, shows a proposed replacement, Accept swaps it via the host update handler.
- A section control (draft): a prompt box, generates a new item, Accept inserts it via the host add handler.
- A review lane inside an existing checklist (proofread): sends the document body, streams an advisory review in a visually distinct box labeled "advisory, not a rule-based check".

---

## 8. Security and compliance (non-negotiable)

1. Session-only key. Use the keyring. Never write the key to localStorage, a cookie, a database, a log, or the DOM value of a non-password field. It clears on tab close.
2. Never commit or hardcode a key. If a key ever appears in chat, a commit, or a log, treat it as compromised and rotate it.
3. Errors never leak the key. The client redacts it. Do not build your own error path that echoes the raw request.
4. Disclose the egress. This is the lesson that bit SemperScribe. If the app previously claimed "no data leaves the browser", that claim is now false. Update the privacy notice and any security doc to state: the assistant is opt-in, off until a key is added, and sends the user-submitted text to the user-chosen provider under the user's key. Name whether any attestation or filtering runs before sending. A live feature that contradicts the app's own security copy is the first thing a reviewer flags.
5. User-responsibility framing for sensitive data. The app cannot guarantee what the user types. State plainly that the user must not submit CUI, PII, PHI, or classified text. For government or DoD contexts, the provider's own terms (for example GenAI.mil prohibits classified, PII, PHI, and monitors usage) also bind the user.
6. Optional pre-send gate. `screenOutbound` (Section 4 plus 5) flags SSN, 10-digit IDs, and PHI keywords. Wire it as a warn or a hard block before content-aware sends if the app needs a safety net. It is heuristic, not a guarantee.

---

## 9. Testing (vitest, mock fetch, no network)

Verify the adapters and the client without hitting a provider. Pattern:

```ts
// build a fake SSE stream and stub fetch
function sseStream(full: string, size = 7): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) { if (pos >= full.length) { c.close(); return; } c.enqueue(enc.encode(full.slice(pos, pos + size))); pos += size; },
  });
}
// vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, body: sseStream(SSE), text: async () => '' })));
```

Cover at minimum:
- Each adapter buildRequest: url, headers (including the Anthropic browser-access header and the Gemini key-in-query), body shape, system handling, proxyBaseUrl override.
- Each adapter parseStreamChunk: token extraction, done/finish reason, ignore control frames and `[DONE]`.
- streamChat: assembles tokens across chunk boundaries, emits one done, aborts to `{done, aborted}`, and on a non-ok response emits a summarized error with the key redacted.
- keyring: writes to sessionStorage, never localStorage, clears on demand.

SemperScribe's suite is 19 cases along these lines and runs under jsdom.

---

## 10. Adding a provider (worked example)

To add any OpenAI-compatible gateway (self-hosted vLLM, another gov gateway, a local Ollama with `OLLAMA_ORIGINS` set):

1. Add the id to the union in `types.ts`: `... | 'myprovider'`.
2. Copy `genaimilAdapter`, rename it, set `id`, `label`, `models`, the host, and `validateKeyShape`. The OpenAI request and parse logic are already correct.
3. Register it: add `myprovider: myproviderAdapter` to `PROVIDER_REGISTRY`.
4. Add an `<option value="myprovider">` to the Settings provider select.

For a non-OpenAI protocol, only `buildRequest` and `parseStreamChunk` differ. Anthropic and Gemini in `providers.ts` are the two reference shapes.

---

## 11. Known pitfalls

- Model IDs. Do not pin one. Gemini free tier: `gemini-2.5-flash` works, `gemini-2.5-pro` free-tier limit is often 0 and returns 429. Anthropic and others rotate model IDs frequently. Always keep the custom-model field.
- CORS is the usual failure. A red console "blocked by CORS policy" or a bare "Failed to fetch" means the origin was refused. Anthropic and Gemini pass from a browser. OpenAI and Azure do not. Use `proxyBaseUrl` or a backend.
- Government networks. A network that reaches a `.mil` endpoint often blocks commercial hosts (Google, Anthropic), and a commercial network does the reverse. Test connection on the network the user will actually use.
- Next.js dev cache. Turbopack ChunkLoadErrors after many hot reloads are stale cache, not code. Delete `.next` and restart.
- PowerShell placeholders. If you hand a user a command with `<PLACEHOLDER>`, tell them to drop the angle brackets. PowerShell treats `<` as reserved and errors.
- Static export basePath. If the app deploys under a path prefix (GitHub Pages project site) and also at a route root (cloud.gov), gate the basePath on a deploy-target env var so asset URLs resolve in both.

---

## 12. File manifest to create in the target app

- `src/lib/gunnybot/types.ts`
- `src/lib/gunnybot/providers.ts`
- `src/lib/gunnybot/client.ts`
- `src/lib/gunnybot/keyring.ts`
- `src/lib/gunnybot/prompts.ts` (rewrite the wording for the app domain)
- `src/lib/gunnybot/context-builder.ts` (adjust the field set)
- `src/lib/gunnybot/redaction.ts` (optional)
- `src/lib/gunnybot/security-scan.ts` (only if using redaction)
- `src/lib/gunnybot/index.ts`
- `src/store/gunnyStore.ts` (or the app's own state)
- UI: a settings panel and one or more action surfaces (Section 7)
- `tests/gunnybot-core.test.ts` (Section 9)

End of handoff.
