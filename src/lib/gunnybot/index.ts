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

export { PROVIDER_REGISTRY, getAdapter, geminiAdapter, genaimilAdapter } from './providers';
export { setKey, getKey, hasKey, clearKey, clearAllKeys } from './keyring';
export {
  getProxyUrl,
  setProxyUrl,
  clearProxyUrl,
  clearAllProxyUrls,
  normalizeProxyUrl,
} from './proxy-config';
export { screenOutbound, clearedForEgress } from './redaction';
export type { RedactionVerdict } from './redaction';
export { registerEgressAckHandler, hasEgressAckHandler, requestEgressAck } from './egress-gate';
export type { EgressAckHandler } from './egress-gate';
export { getSystemPrompt } from './prompts';
export { buildContext } from './context-builder';
export type { GunnyContextInput, GunnyContext } from './context-builder';
export { streamChat } from './client';
export type { StreamHandlers } from './client';
