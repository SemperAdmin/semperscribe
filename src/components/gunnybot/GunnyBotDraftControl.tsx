'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Check, X, Square, Sparkles } from 'lucide-react';
import { useGunnyStore } from '@/store/gunnyStore';
import { streamChat } from '@/lib/gunnybot/client';
import { getSystemPrompt } from '@/lib/gunnybot/prompts';
import { buildContext } from '@/lib/gunnybot/context-builder';
import { getKey } from '@/lib/gunnybot/keyring';
import type { GunnyMessage } from '@/lib/gunnybot/types';
import { useToast } from '@/hooks/use-toast';

interface GunnyBotDraftControlProps {
  documentType: string;
  onInsert: (text: string) => void;
}

/**
 * Section-level drafting. The user describes a paragraph, GunnyBot drafts
 * it, and Accept inserts it as a new main paragraph through the existing
 * add path. GunnyBot never adds a paragraph on its own.
 */
export function GunnyBotDraftControl({ documentType, onInsert }: GunnyBotDraftControlProps) {
  const provider = useGunnyStore(s => s.provider);
  const model = useGunnyStore(s => s.model);
  const keyPresent = useGunnyStore(s => s.keyPresent);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (streaming) {
      return;
    }
    const p = prompt.trim();
    if (p.length === 0) {
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
    const context = buildContext({ task: 'draft', documentType, subject: '', body: '', question: p });
    const outgoing: GunnyMessage[] = [
      { role: 'system', content: getSystemPrompt('draft') },
      { role: 'user', content: context.text },
    ];
    await streamChat(
      { provider, model, apiKey: key, messages: outgoing, maxOutputTokens: 1024 },
      {
        signal: controller.signal,
        onEvent: e => {
          if (e.kind === 'token') {
            setProposal(prev => (prev ?? '') + e.text);
          } else if (e.kind === 'error') {
            toast({ title: 'Draft failed', description: e.message, variant: 'destructive' });
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
      onInsert(proposal.trim());
      toast({ title: 'Paragraph added' });
    }
    setProposal(null);
    setPrompt('');
    setOpen(false);
  };

  const reject = () => {
    setProposal(null);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-xs">
        <Bot className="h-3.5 w-3.5 mr-1" /> Draft a paragraph with GunnyBot
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="h-4 w-4 text-primary" /> Draft with GunnyBot
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 text-xs"
          onClick={() => { setOpen(false); setProposal(null); }}
        >
          Close
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Describe the paragraph you need. Accept adds it as a new main paragraph. Advisory, verify against policy.
      </p>
      <Textarea
        value={prompt}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
        placeholder="e.g. a paragraph directing all hands to complete annual cyber awareness training by 30 September"
        className="min-h-[60px] text-sm"
        disabled={streaming}
      />
      {proposal !== null && (
        <div className="text-sm font-serif whitespace-pre-wrap rounded bg-background border border-border p-2">
          {proposal.length > 0 ? proposal : <span className="text-muted-foreground">...</span>}
        </div>
      )}
      <div className="flex gap-2">
        {streaming ? (
          <Button variant="outline" size="sm" onClick={stop}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        ) : proposal !== null ? (
          <>
            <Button size="sm" onClick={accept} disabled={proposal.trim().length === 0}>
              <Check className="h-3 w-3 mr-1" /> Accept and add
            </Button>
            <Button variant="ghost" size="sm" onClick={reject}>
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => void run()} disabled={!keyPresent || prompt.trim().length === 0}>
            <Sparkles className="h-3 w-3 mr-1" /> Generate
          </Button>
        )}
      </div>
      {!keyPresent && <p className="text-xs text-muted-foreground">Add your API key in Settings, Assistant tab.</p>}
    </div>
  );
}
