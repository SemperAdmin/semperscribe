'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Check, X, Square, Loader2 } from 'lucide-react';
import { useGunnyStore } from '@/store/gunnyStore';
import { streamChat } from '@/lib/gunnybot/client';
import { getSystemPrompt } from '@/lib/gunnybot/prompts';
import { getKey } from '@/lib/gunnybot/keyring';
import type { GunnyMessage } from '@/lib/gunnybot/types';
import { useToast } from '@/hooks/use-toast';

interface GunnyBotRewriteControlProps {
  content: string;
  onAccept: (rewritten: string) => void;
}

/**
 * Per-paragraph rewrite. Streams a naval-voice rewrite of one paragraph
 * and shows it as a proposed replacement. Accept calls onAccept with the
 * new text; Reject discards. GunnyBot never writes the paragraph itself.
 */
export function GunnyBotRewriteControl({ content, onAccept }: GunnyBotRewriteControlProps) {
  const provider = useGunnyStore(s => s.provider);
  const model = useGunnyStore(s => s.model);
  const keyPresent = useGunnyStore(s => s.keyPresent);
  const { toast } = useToast();

  const [proposal, setProposal] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (streaming) {
      return;
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return;
    }
    const key = getKey(provider);
    if (!key) {
      toast({ title: 'Add your API key', description: 'Open Settings, then the Assistant tab.', variant: 'destructive' });
      return;
    }
    setProposal('');
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const outgoing: GunnyMessage[] = [
      { role: 'system', content: getSystemPrompt('rewrite') },
      { role: 'user', content: trimmed },
    ];
    await streamChat(
      { provider, model, apiKey: key, messages: outgoing, maxOutputTokens: 1024 },
      {
        signal: controller.signal,
        onEvent: e => {
          if (e.kind === 'token') {
            setProposal(prev => (prev ?? '') + e.text);
          } else if (e.kind === 'error') {
            toast({ title: 'Rewrite failed', description: e.message, variant: 'destructive' });
            setProposal(null);
          }
        },
      },
    );
    setStreaming(false);
    abortRef.current = null;
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const accept = () => {
    if (proposal && proposal.trim().length > 0) {
      onAccept(proposal.trim());
    }
    setProposal(null);
  };

  const reject = () => {
    setProposal(null);
  };

  if (proposal === null) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void run()}
        disabled={!keyPresent || content.trim().length === 0}
        className="h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
      >
        <Bot className="h-3.5 w-3.5 mr-1" /> GunnyBot rewrite
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="h-3.5 w-3.5 text-primary" />
        Proposed rewrite, advisory. Accept to replace this paragraph.
        {streaming && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
      </div>
      <div className="text-sm font-serif whitespace-pre-wrap rounded bg-background border border-border p-2">
        {proposal.length > 0 ? proposal : <span className="text-muted-foreground">...</span>}
      </div>
      <div className="flex gap-2">
        {streaming ? (
          <Button variant="outline" size="sm" onClick={stop}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={accept} disabled={proposal.trim().length === 0}>
              <Check className="h-3 w-3 mr-1" /> Accept
            </Button>
            <Button variant="ghost" size="sm" onClick={reject}>
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
