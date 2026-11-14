'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Video } from 'lucide-react';
import { libraryGroups } from '@/lib/how-to-videos';
import { VideoLink } from './VideoLink';

interface HowToVideosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The how-to video library (spec 6). Same Dialog parts and size as
 * GuidanceDialog. Groups in spec order, no search.
 */
export function HowToVideosDialog({ open, onOpenChange }: HowToVideosDialogProps) {
  const groups = libraryGroups();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[70vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Video className="w-4 h-4" /> How-To Videos
          </DialogTitle>
          <DialogDescription>
            Each video opens on MarineNet in a new tab. Log in to watch.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto native-scroll pr-3">
          <div className="space-y-4">
            {groups.map(g => (
              <section key={g.key} data-testid="howto-video-group" data-group={g.key} aria-labelledby={`howto-${g.key}`}>
                <h3 id={`howto-${g.key}`} className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h3>
                <div className="space-y-0.5">
                  {g.videos.map(v => <VideoLink key={v.id} video={v} />)}
                </div>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
