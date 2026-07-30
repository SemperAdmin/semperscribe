// GunnyBot shared types. Phase 0 skeleton, no runtime behavior.
// Wiring lands in Phase 1. Nothing in the running app imports this yet.

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
  // direct browser CORS (OpenAI, Azure per the Phase 0 verdict).
  proxyBaseUrl?: string;
  // Ask the provider to skip server-side reasoning for this call.
  //
  // Reasoning tokens bill against maxOutputTokens before any visible text.
  // On gemini-2.5-flash, measured usage swung between 17 and 209 tokens on
  // the same model, so a small budget returns HTTP 200 with an empty body
  // and no text at all. Set this on short deterministic calls such as the
  // Test connection ping. Leave it off for real work, where reasoning
  // improves the answer and the budget is large enough to absorb it.
  //
  // Providers with no reasoning control ignore it.
  disableReasoning?: boolean;
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
  // True when the provider answers direct browser calls without a proxy.
  browserDirect: boolean;
  validateKeyShape(key: string): boolean;
  buildRequest(req: GunnyRequest): GunnyHttpRequest;
  parseStreamChunk(raw: string): GunnyStreamEvent[];
  // When false, the client reads one full JSON response instead of an SSE
  // stream and calls parseFullResponse. Omit for streaming providers.
  streaming?: boolean;
  parseFullResponse?(json: unknown): GunnyStreamEvent[];
}
