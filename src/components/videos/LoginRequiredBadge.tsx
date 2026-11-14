import { ExternalLink, LockKeyhole } from 'lucide-react';

/**
 * "MarineNet login" badge on every how-to video link (spec 6). Inline
 * lucide SVG, theme tokens only, so light and dark follow the app.
 * The badge text is part of the link's accessible name (WCAG 2.5.3,
 * label in name); only the icons are aria-hidden. text-foreground on
 * bg-muted keeps 10px text above the 4.5:1 contrast minimum in both
 * themes (axe color-contrast, tests/e2e/axe.spec.ts).
 */
export function LoginRequiredBadge() {
  return (
    <span
      data-testid="login-required-badge"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
    >
      <LockKeyhole aria-hidden="true" className="h-3 w-3" />
      MarineNet login
      <ExternalLink aria-hidden="true" className="h-3 w-3" />
    </span>
  );
}
