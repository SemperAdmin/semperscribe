import { useHydrated } from '@/hooks/useHydrated';

/**
 * D.7: the command palette (R8) has been keyboard-only since it shipped,
 * with nothing on screen naming its shortcut. This is the label the
 * header hint prints, matching the modifiers `useCommandPalette` listens
 * for: Ctrl on Windows and Linux, Cmd on macOS.
 */
export const DEFAULT_PALETTE_SHORTCUT = 'Ctrl K';
export const MAC_PALETTE_SHORTCUT = 'Cmd K';

/** Pure, so the platform strings the label turns on are testable. */
export function paletteShortcutLabel(platform: string, userAgent = ''): string {
  return /mac/i.test(platform) || /mac os x|macintosh/i.test(userAgent)
    ? MAC_PALETTE_SHORTCUT
    : DEFAULT_PALETTE_SHORTCUT;
}

/**
 * The shortcut label for the browser on screen. The static export is
 * built with no platform to read, so the server markup and the hydration
 * render both carry the Ctrl label and the Mac label arrives on the
 * first client render after hydration.
 */
export function useCommandPaletteHint(): string {
  const hydrated = useHydrated();
  if (!hydrated || typeof navigator === 'undefined') return DEFAULT_PALETTE_SHORTCUT;
  // navigator.platform is deprecated and still the most reliable read
  // outside Chromium, where userAgentData is not offered to every page.
  return paletteShortcutLabel(navigator.platform || '', navigator.userAgent || '');
}
