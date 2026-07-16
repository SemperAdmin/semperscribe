/**
 * P1.4 (DONDOCS_PARITY_PLAN) - captures the browser's install prompt.
 *
 * Chromium fires `beforeinstallprompt` once, early. The listener here
 * is registered from ServiceWorkerRegister on first client render and
 * parks the event so the Settings install button is able to re-fire it.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenerAttached = false;

export function attachInstallPromptListener(): void {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export function isStandalone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Fires the parked install prompt. Returns the user's choice, or
 * 'unavailable' when no prompt is parked.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const parked = deferredPrompt;
  deferredPrompt = null;
  await parked.prompt();
  const choice = await parked.userChoice;
  return choice.outcome;
}
