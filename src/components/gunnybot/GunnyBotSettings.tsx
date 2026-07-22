'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KeyRound, Check, Loader2, ShieldAlert } from 'lucide-react';
import { useGunnyStore } from '@/store/gunnyStore';
import { getAdapter } from '@/lib/gunnybot/providers';
import { streamChat } from '@/lib/gunnybot/client';
import { setKey as saveKey, clearKey, getKey } from '@/lib/gunnybot/keyring';
import type { GunnyProviderId } from '@/lib/gunnybot/types';
import { useToast } from '@/hooks/use-toast';

export function GunnyBotSettings() {
  const provider = useGunnyStore(s => s.provider);
  const setProvider = useGunnyStore(s => s.setProvider);
  const model = useGunnyStore(s => s.model);
  const setModel = useGunnyStore(s => s.setModel);
  const keyPresent = useGunnyStore(s => s.keyPresent);
  const setKeyPresent = useGunnyStore(s => s.setKeyPresent);
  const { toast } = useToast();

  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);

  const adapter = getAdapter(provider);
  const models = adapter?.models ?? [];

  const handleProviderChange = (value: string) => {
    const next = value as GunnyProviderId;
    setProvider(next);
    const first = getAdapter(next)?.models[0]?.id;
    if (first) {
      setModel(first);
    }
    setKeyPresent(getKey(next) !== null);
  };

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (adapter && !adapter.validateKeyShape(trimmed)) {
      toast({
        title: 'Key shape looks off',
        description: 'Saving anyway. Confirm it matches your provider.',
      });
    }
    saveKey(provider, trimmed);
    setKeyPresent(true);
    setKeyInput('');
    toast({ title: 'Key saved for this session', description: 'Cleared when you close the tab.' });
  };

  const handleClearKey = () => {
    clearKey(provider);
    setKeyPresent(false);
    toast({ title: 'Key cleared' });
  };

  const handleTest = async () => {
    const key = getKey(provider);
    if (!key) {
      toast({ title: 'No key set', description: 'Save an API key first.', variant: 'destructive' });
      return;
    }
    setTesting(true);
    let ok = false;
    let errMsg = '';
    await streamChat(
      {
        provider,
        model,
        apiKey: key,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
        maxOutputTokens: 16,
      },
      {
        onEvent: e => {
          if (e.kind === 'token' || e.kind === 'done') {
            ok = true;
          }
          if (e.kind === 'error') {
            errMsg = e.message;
          }
        },
      },
    );
    setTesting(false);
    if (ok && errMsg.length === 0) {
      toast({ title: 'Connection good', description: adapter?.label + ' answered.' });
    } else {
      toast({ title: 'Connection failed', description: errMsg || 'No response.', variant: 'destructive' });
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <p className="text-sm text-muted-foreground">
        GunnyBot uses your own provider API key. The key stays in this browser tab only and clears when you close it.
      </p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Provider</h3>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger className="bg-background border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
            <SelectItem value="openai" disabled>OpenAI (needs a proxy - later)</SelectItem>
            <SelectItem value="azure" disabled>Azure OpenAI (needs a proxy - later)</SelectItem>
          </SelectContent>
        </Select>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Model</Label>
          <Select value={models.some(m => m.id === model) ? model : ''} onValueChange={setModel}>
            <SelectTrigger className="bg-background border-input">
              <SelectValue placeholder="Pick a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={model}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModel(e.target.value)}
            placeholder="or type a model ID"
            className="bg-background border-input font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">Model IDs change over time. Type any current ID your key supports.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">API Key</h3>
        {keyPresent && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
              <Check className="w-3 h-3 mr-1" /> Key set for this session
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleClearKey}>Clear</Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            type="password"
            value={keyInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyInput(e.target.value)}
            placeholder={keyPresent ? 'Replace the saved key...' : 'Paste your API key'}
            autoComplete="off"
            className="bg-background border-input font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={handleSaveKey} disabled={keyInput.trim().length === 0}>
            <KeyRound className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleTest} disabled={!keyPresent || testing}>
          {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
          Test connection
        </Button>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          What you send to GunnyBot leaves your browser and goes to your chosen provider under your key. Do not enter CUI, PII, or classified text.
        </p>
      </div>
    </div>
  );
}
