import { create } from 'zustand';
import type { GunnyProviderId, GunnyMessage } from '@/lib/gunnybot/types';

/**
 * GunnyBot UI state. The API key never lives here - it stays in the
 * session-only keyring. This store holds provider and model selection,
 * the panel open flag, a key-presence mirror, and the conversation.
 */
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
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  appendToLast: (text) =>
    set((state) => {
      if (state.messages.length === 0) {
        return state;
      }
      const next = state.messages.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { role: last.role, content: last.content + text };
      return { messages: next };
    }),
  resetConversation: () => set({ messages: [] }),
}));
