'use client';

import React, { useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGunnyStore } from '@/store/gunnyStore';
import { streamChat } from '@/lib/gunnybot/client';
import { getSystemPrompt } from '@/lib/gunnybot/prompts';
import { getKey } from '@/lib/gunnybot/keyring';
import { screenOutbound } from '@/lib/gunnybot/redaction';
import type { GunnyMessage } from '@/lib/gunnybot/types';
import { useToast } from '@/hooks/use-toast';

export function GunnyBotPanel() {
  const open = useGunnyStore(s => s.panelOpen);
  const setOpen = useGunnyStore(s => s.setPanelOpen);
  const provider = useGunnyStore(s => s.provider);
  const model = useGunnyStore(s => s.model);
  const keyPresent = useGunnyStore(s => s.keyPresent);
  const streaming = useGunnyStore(s => s.streaming);
  const setStreaming = useGunnyStore(s => s.setStreaming);
  const messages = useGunnyStore(s => s.messages);
  const addMessage = useGunnyStore(s => s.addMessage);
  const appendToLast = useGunnyStore(s => s.appendToLast);
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    const question = input.trim();
    if (question.length === 0 || streaming) {
      return;
    }
    const key = getKey(provider);
    if (!key) {
      toast({ title: 'Add your API key', description: 'Open Settings, then the Assistant tab.', variant: 'destructive' });
      return;
    }
    const screen = screenOutbound(question);
    if (screen.blocked) {
      toast({ title: 'Sensitive data detected', description: 'Remove ' + screen.findings.join(', ') + ' before sending.', variant: 'destructive' });
      return;
    }

    setInput('');
    addMessage({ role: 'user', content: question });
    addMessage({ role: 'assistant', content: '' });
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const history = useGunnyStore.getState().messages.filter(m => m.content.length > 0);
    const outgoing: GunnyMessage[] = [{ role: 'system', content: getSystemPrompt('qa') }, ...history];

    await streamChat(
      { provider, model, apiKey: key, messages: outgoing, maxOutputTokens: 1024 },
      {
        signal: controller.signal,
        onEvent: e => {
          if (e.kind === 'token') {
            appendToLast(e.text);
          } else if (e.kind === 'error') {
            appendToLast('\n[error] ' + e.message);
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            GunnyBot
            <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
              {provider} / {model}
            </Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Format and policy questions. Your message goes to your configured provider. Do not enter CUI, PII, or classified text. Answers are advisory - verify against the source.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {keyPresent
                ? 'Ask about SECNAV M-5216.5 format, SSIC, references, or a correspondence rule.'
                : 'Add your API key in Settings, Assistant tab, to begin.'}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-primary/10 text-foreground ml-6'
                      : 'bg-muted text-foreground mr-6',
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {m.role === 'user' ? 'You' : 'GunnyBot'}
                  </div>
                  {m.content.length > 0
                    ? m.content
                    : streaming
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : ''}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border space-y-2">
          <Textarea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a format or policy question..."
            className="min-h-[64px] resize-none"
            disabled={streaming}
          />
          <div className="flex gap-2">
            {streaming ? (
              <Button variant="outline" size="sm" onClick={stop} className="flex-1">
                <Square className="w-3 h-3 mr-1" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void send()} disabled={input.trim().length === 0} className="flex-1">
                <Send className="w-3 h-3 mr-1" /> Send
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
