import { ExternalLink, LockKeyhole } from 'lucide-react';

/**
 * "MarineNet login" badge on every how-to video link (spec 6). Inline
 * lucide SVG, theme tokens only, so light and dark follow the app. The
 * whole badge is aria-hidden: the link's accessible name already says
 * "login required, opens in a new tab".
 */
export function LoginRequiredBadge() {
  return (
    <span
      aria-hidden="true"
      data-testid="login-required-badge"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      <LockKeyhole className="h-3 w-3" />
      MarineNet login
      <ExternalLink className="h-3 w-3" />
    </span>
  );
}
