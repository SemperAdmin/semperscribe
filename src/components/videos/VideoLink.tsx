'use client';

import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HowToVideo } from '@/lib/how-to-videos';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { LoginRequiredBadge } from './LoginRequiredBadge';

interface VideoLinkProps {
  video: HowToVideo;
  /** Header form: "Watch how-to: <title>", no summary. */
  compact?: boolean;
}

/**
 * One how-to video row (spec 6 and 7). Three states, exposed as
 * data-state for the tests:
 *   link         an anchor to MarineNet in a new tab
 *   coming-soon  no URL yet, plain text
 *   offline      the browser reports no network, plain text
 * The app makes no request of its own: no tracking, no prefetch.
 */
export function VideoLink({ video, compact = false }: VideoLinkProps) {
  const online = useOnlineStatus();
  const title = compact ? `Watch how-to: ${video.title}` : video.title;
  const state = !video.url ? 'coming-soon' : online ? 'link' : 'offline';

  if (state !== 'link') {
    return (
      <div
        data-video-id={video.id}
        data-state={state}
        className="flex items-start justify-between gap-2 px-1 py-1.5 text-muted-foreground"
      >
        <span className="min-w-0">
          <span className="text-sm">{title}</span>
          <span className="block text-xs">
            {state === 'coming-soon' ? 'Coming soon' : 'Needs a network connection'}
          </span>
        </span>
      </div>
    );
  }

  // Hover fills the row with --accent (the same gold as text-primary), so
  // every child with its own color inverts to --accent-foreground.
  return (
    <a
      href={video.url!}
      target="_blank"
      rel="noopener noreferrer"
      data-video-id={video.id}
      data-state="link"
      className={cn(
        'group flex items-start justify-between gap-2 rounded px-1 py-1.5 text-foreground',
        'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        {compact && <PlayCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary group-hover:text-accent-foreground" />}
        <span className="min-w-0">
          <span className="text-sm font-medium text-primary group-hover:text-accent-foreground">{title}</span>
          {!compact && <>{' '}<span className="block text-xs text-muted-foreground group-hover:text-accent-foreground">{video.summary}</span></>}
        </span>
      </span>
      {' '}
      <LoginRequiredBadge />
      {/* WCAG 2.5.3: the visible text, badge included, stays the start of the
          accessible name; this finishes it for screen readers. */}
      {' '}<span className="sr-only">required, opens in a new tab</span>
    </a>
  );
}
