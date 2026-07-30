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

// GenAI.mil grants access to a catalog of models per the user's key. Only
// a known-good default is listed; the custom model field carries the rest.
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

interface GeminiGenerationConfig {
  maxOutputTokens: number;
  thinkingConfig?: { thinkingBudget: number };
}

interface GeminiBody {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
  // The Content schema declares parts as repeated. The live endpoint also
  // accepts a single object and coerces it, verified against the API on
  // 2026-07-30: both shapes returned identical output and an identical
  // promptTokenCount. The array is the documented form, so use it.
  systemInstruction?: { parts: { text: string }[] };
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

  // Google has issued more than one key format. A working key measured on
  // 2026-07-30 was 53 characters and did not start with "AIza", so the old
  // prefix requirement rejected a valid key and showed a misleading
  // warning. Check only for length and for another provider's prefix.
  validateKeyShape(key: string): boolean {
    const trimmed = key.trim();
    if (trimmed.length < 30) {
      return false;
    }
    // "sk-" covers Anthropic and OpenAI keys pasted into the wrong slot.
    return !trimmed.startsWith('sk-');
  },

  buildRequest(req: GunnyRequest): GunnyHttpRequest {
    const system = joinSystem(req);
    const contents: GeminiContent[] = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const generationConfig: GeminiGenerationConfig = { maxOutputTokens: req.maxOutputTokens };
    if (req.disableReasoning === true) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const body: GeminiBody = { contents, generationConfig };
    if (system.length > 0) {
      body.systemInstruction = { parts: [{ text: system }] };
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

// GenAI.mil: the DoD GenAI gateway. OpenAI-compatible chat completions
// (Bearer auth, POST /v1/chat/completions). Browser-direct reach is
// unverified. Confirm with Test connection, and set proxyBaseUrl if the
// endpoint refuses the browser origin or is network-gated.
export const genaimilAdapter: ProviderAdapter = {
  id: 'genaimil',
  label: 'GenAI.mil',
  models: GENAIMIL_MODELS,
  browserDirect: true,
  streaming: false,

  validateKeyShape(key: string): boolean {
    return key.trim().length > 20;
  },

  buildRequest(req: GunnyRequest): GunnyHttpRequest {
    const body: OpenAICompatibleBody = {
      model: req.model,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
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

  // GenAI.mil is used non-streaming (the working reference sends
  // stream:false). The client calls this with the full parsed JSON.
  //
  // A 200 carrying no content is a failure, not a silent success. Emitting
  // an unconditional done here made an empty or unrecognized body look
  // like a clean answer, which is how a broken provider passed Test
  // connection. Report it instead.
  parseFullResponse(json: unknown): GunnyStreamEvent[] {
    const data = json as {
      choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
    };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.length > 0) {
      return [
        { kind: 'token', text: content },
        { kind: 'done', stopReason: choice?.finish_reason ? String(choice.finish_reason) : null },
      ];
    }
    const finish = choice?.finish_reason ? String(choice.finish_reason) : '';
    const why =
      finish.length > 0
        ? 'The provider stopped with finish_reason "' + finish + '".'
        : 'The response carried no choices[0].message.content.';
    return [{ kind: 'error', message: 'Provider returned no content. ' + why }];
  },
};

// OpenAI and Azure are NO-GO for direct browser calls per the Phase 0
// verdict. They stay null until the optional user-proxy path ships.
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
