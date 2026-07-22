'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Square, Loader2, Sparkles } from 'lucide-react';
import { useGunnyStore } from '@/store/gunnyStore';
import { streamChat } from '@/lib/gunnybot/client';
import { getSystemPrompt } from '@/lib/gunnybot/prompts';
import { buildContext } from '@/lib/gunnybot/context-builder';
import { getKey } from '@/lib/gunnybot/keyring';
import type { GunnyMessage } from '@/lib/gunnybot/types';
import { useToast } from '@/hooks/use-toast';

interface GunnyBotReviewSectionProps {
  documentType: string;
  subject: string;
  body: string;
}

/**
 * Advisory LLM review inside the proofreading checklist, in a visually
 * distinct lane so a model opinion never reads as a rule-based pass or
 * fail. Sends the draft to the configured provider on click.
 */
export function GunnyBotReviewSection({ documentType, subject, body }: GunnyBotReviewSectionProps) {
  const provider = useGunnyStore(s => s.provider);
  const model = useGunnyStore(s => s.model);
  const keyPresent = useGunnyStore(s => s.keyPresent);
  const { toast } = useToast();

  const [reviewing, setReviewing] = useState(false);
  const [output, setOutput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (reviewing) {
      return;
    }
    const key = getKey(provider);
    if (!key) {
      toast({ title: 'Add your API key', description: 'Open Settings, then the Assistant tab.', variant: 'destructive' });
      return;
    }
    const context = buildContext({ task: 'proofread', documentType, subject, body });
    const outgoing: GunnyMessage[] = [
      { role: 'system', content: getSystemPrompt('proofread') },
      { role: 'user', content: context.text },
    ];
    setOutput('');
    setReviewing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    await streamChat(
      { provider, model, apiKey: key, messages: outgoing, maxOutputTokens: 1024 },
      {
        signal: controller.signal,
        onEvent: e => {
          if (e.kind === 'token') {
            setOutput(prev => prev + e.text);
          } else if (e.kind === 'error') {
            setOutput(prev => prev + '\n[error] ' + e.message);
          }
        },
      },
    );
    setReviewing(false);
    abortRef.current = null;
  };

  const stop = () => {
    abortRef.current?.abort();
    setReviewing(false);
  };

  return (
    <div className="border border-primary/30 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-primary/5 border-b border-primary/20">
        <Bot className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">GunnyBot review</div>
          <div className="text-xs text-muted-foreground">
            Advisory AI opinion, not a rule-based check. Verify against the source publication.
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal shrink-0">{provider} / {model}</Badge>
      </div>
      <div className="p-3 space-y-3">
        {output.length > 0 && (
          <div className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-3 border border-border">
            {output}
          </div>
        )}
        <div className="flex items-center gap-2">
          {reviewing ? (
            <Button variant="outline" size="sm" onClick={stop}>
              <Square className="h-3 w-3 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => void run()} disabled={!keyPresent}>
              {output.length > 0 ? <Sparkles className="h-3 w-3 mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
              {output.length > 0 ? 'Review again' : 'Run GunnyBot review'}
            </Button>
          )}
          {reviewing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {!keyPresent && (
          <p className="text-xs text-muted-foreground">Add your API key in Settings, Assistant tab, to enable review.</p>
        )}
      </div>
    </div>
  );
}
