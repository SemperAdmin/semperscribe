'use client';

import { videosForType } from '@/lib/how-to-videos';
import { VideoLink } from './VideoLink';

interface HowToVideoLinksProps {
  /** Active registry type id (a same-page endorsement is 'endorsement'). */
  typeId?: string;
  /** Optional heading, used inside GuidanceDialog. */
  heading?: string;
}

/**
 * The contextual "Watch how-to" rows for one document type (spec 6).
 * Renders nothing when the type has no video with a URL, so a type
 * without a video shows no empty row.
 */
export function HowToVideoLinks({ typeId, heading }: HowToVideoLinksProps) {
  const videos = typeId ? videosForType(typeId).filter(v => v.url) : [];
  if (videos.length === 0) return null;
  return (
    <div data-testid="howto-video-links" className="mt-2">
      {heading && (
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{heading}</h4>
      )}
      <div className="space-y-0.5">
        {videos.map(v => <VideoLink key={v.id} video={v} compact />)}
      </div>
    </div>
  );
}
