import type {
  GunnyRequest,
  GunnyHttpRequest,
  GunnyStreamEvent,
  ProviderAdapter,
  GunnyModel,
  GunnyProviderId,
} from './types';

// Provider adapters. Each turns a GunnyRequest into an HTTP request and
// parses the provider's SSE data payloads into GunnyStreamEvents.
//
// Model IDs churn. These lists carry current defaults verified 2026-07-22.
// The UI also accepts a custom model string, and the provider Models API
// is the source of truth. Do not treat these as exhaustive.

const ANTHROPIC_MODELS: GunnyModel[] = [
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', contextWindow: 1000000 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextWindow: 1000000 },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', contextWindow: 200000 },
];

const GEMINI_MODELS: GunnyModel[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextWindow: 1000000 },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextWindow: 1000000 },
];

const ANTHROPIC_HOST = 'https://api.anthropic.com';
const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

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

function joinSystem(req: GunnyRequest): string {
  return req.messages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n\n');
}

// Anthropic: browser-direct GO per the Phase 0 verdict (0.85).
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
    // message_start, content_block_start, content_block_stop, message_stop,
    // and ping carry no user-visible token and end cleanly.
    return [];
  },
};

// Gemini: browser-direct CONDITIONAL per the Phase 0 verdict (0.6).
// Key rides the query string and only content-type is sent, to keep the
// CORS preflight minimal (a custom auth header can fail Google preflight).
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

// OpenAI and Azure are NO-GO for direct browser calls per the Phase 0
// verdict. They stay null until the optional user-proxy path ships.
export const PROVIDER_REGISTRY: Record<GunnyProviderId, ProviderAdapter | null> = {
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  openai: null,
  azure: null,
};

export function getAdapter(id: GunnyProviderId): ProviderAdapter | null {
  return PROVIDER_REGISTRY[id];
}
