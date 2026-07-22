// GunnyBot public surface. Phase 0 skeleton.

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

export { PROVIDER_REGISTRY, getAdapter, anthropicAdapter, geminiAdapter } from './providers';
export { setKey, getKey, hasKey, clearKey, clearAllKeys } from './keyring';
export { screenOutbound } from './redaction';
export type { RedactionVerdict } from './redaction';
export { getSystemPrompt } from './prompts';
export { buildContext } from './context-builder';
export type { GunnyContextInput, GunnyContext } from './context-builder';
export { streamChat } from './client';
export type { StreamHandlers } from './client';
