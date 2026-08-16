'use client';

import React, { useEffect, useState } from 'react';
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
import { KeyRound, Check, Loader2, ShieldAlert, Server, XCircle } from 'lucide-react';
import { useGunnyStore } from '@/store/gunnyStore';
import { getAdapter } from '@/lib/gunnybot/providers';
import { streamChat } from '@/lib/gunnybot/client';
import { setKey as saveKey, clearKey, getKey } from '@/lib/gunnybot/keyring';
import {
  getProxyUrl,
  setProxyUrl,
  clearProxyUrl,
} from '@/lib/gunnybot/proxy-config';
import type { GunnyProviderId } from '@/lib/gunnybot/types';
import { useToast } from '@/hooks/use-toast';
import { isEdmsMode, EDMS_ALLOWED_PROVIDER } from '@/lib/edms-mode';

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

  // Proxy base URL for the selected provider. Read after mount only:
  // localStorage does not exist during the static-export prerender, and
  // reading it in the render body would hydrate to a different tree, the
  // same trap the EDMS flag below avoids.
  const [proxyInput, setProxyInput] = useState('');
  const [proxySaved, setProxySaved] = useState<string | null>(null);

  // EDMS mode is read after mount, never during render. sessionStorage
  // is unavailable during the static-export prerender, so reading it in
  // the render body would hydrate to a different tree.
  const [edmsLocked, setEdmsLocked] = useState(false);
  useEffect(() => {
    // Proxy settings live in localStorage, which the static-export
    // prerender does not have. Read once here, then keep the value in
    // step from handleProviderChange rather than from a second effect.
    setProxySaved(getProxyUrl(useGunnyStore.getState().provider));
    if (!isEdmsMode()) return;
    setEdmsLocked(true);
    // Snap the selection to the only cleared provider. This is a
    // convenience so the panel matches what the gate will allow. The
    // control itself is in lib/gunnybot/client.ts.
    if (provider !== EDMS_ALLOWED_PROVIDER) {
      setProvider(EDMS_ALLOWED_PROVIDER);
      const first = getAdapter(EDMS_ALLOWED_PROVIDER)?.models[0]?.id;
      if (first) setModel(first);
      setKeyPresent(getKey(EDMS_ALLOWED_PROVIDER) !== null);
      setProxySaved(getProxyUrl(EDMS_ALLOWED_PROVIDER));
    }
    // Mount-only. EDMS mode does not change within a tab's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adapter = getAdapter(provider);
  const models = adapter?.models ?? [];

  // True when the provider is known to refuse direct browser calls. The
  // flag is measured per provider in lib/gunnybot/providers.ts.
  const proxyRequired = adapter !== null && !adapter.browserDirect;
  const proxyMissing = proxyRequired && proxySaved === null;

  const handleProviderChange = (value: string) => {
    if (edmsLocked) return;
    const next = value as GunnyProviderId;
    setProvider(next);
    const first = getAdapter(next)?.models[0]?.id;
    if (first) {
      setModel(first);
    }
    setKeyPresent(getKey(next) !== null);
    setProxySaved(getProxyUrl(next));
    setProxyInput('');
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
    toast({ title: 'Key saved for this session', description: 'Kept in memory only — re-enter it after a reload.' });
  };

  const handleClearKey = () => {
    clearKey(provider);
    setKeyPresent(false);
    toast({ title: 'Key cleared' });
  };

  const handleSaveProxy = () => {
    const normalized = setProxyUrl(provider, proxyInput);
    if (normalized === null) {
      toast({
        title: 'Proxy URL rejected',
        description:
          'Give a full http or https base URL with no query string, for example http://127.0.0.1:8443',
        variant: 'destructive',
      });
      return;
    }
    setProxySaved(normalized);
    setProxyInput('');
    toast({ title: 'Proxy saved', description: normalized });
  };

  const handleClearProxy = () => {
    clearProxyUrl(provider);
    setProxySaved(null);
    toast({ title: 'Proxy cleared' });
  };

  const handleTest = async () => {
    const key = getKey(provider);
    if (!key) {
      toast({ title: 'No key set', description: 'Save an API key first.', variant: 'destructive' });
      return;
    }
    setTesting(true);
    // Success requires real text back. A bare done event proves only that
    // the transport closed, which is how an empty answer used to report
    // "Connection good". The budget is generous so a reasoning model does
    // not spend the whole allowance on thinking and return nothing.
    let sawText = false;
    let errMsg = '';
    await streamChat(
      {
        provider,
        model,
        apiKey: key,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
        maxOutputTokens: 256,
        // Reasoning off for the probe only. Feature calls keep it on.
        disableReasoning: true,
      },
      {
        onEvent: e => {
          if (e.kind === 'token' && e.text.trim().length > 0) {
            sawText = true;
          }
          if (e.kind === 'error') {
            errMsg = e.message;
          }
        },
      },
    );
    setTesting(false);
    if (sawText && errMsg.length === 0) {
      toast({ title: 'Connection good', description: adapter?.label + ' answered.' });
      return;
    }
    const description =
      errMsg.length > 0
        ? errMsg
        : 'The provider accepted the request and returned no text. Check the model ID against what your key supports.';
    toast({ title: 'Connection failed', description, variant: 'destructive' });
  };

  return (
    <div className="mt-4 space-y-6">
      <p className="text-sm text-muted-foreground">
        GunnyBot uses your own provider API key. The key is held in memory only — it never touches browser storage and is forgotten when you reload or close the tab.
      </p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Provider</h3>
        {edmsLocked && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 flex gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              EDMS mode. This draft is bound for an EDMS request, so GunnyBot is locked to GenAI.mil.
              Commercial providers are blocked at the send path, not only here. Draft outside EDMS in a
              new tab to use them.
            </p>
          </div>
        )}
        <Select value={provider} onValueChange={handleProviderChange} disabled={edmsLocked}>
          <SelectTrigger className="bg-background border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="genaimil">GenAI.mil (DoD)</SelectItem>
            <SelectItem value="gemini" disabled={edmsLocked}>Google Gemini</SelectItem>
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

      {proxyRequired && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Provider proxy</h3>

          {proxyMissing && (
            <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 flex gap-2">
              <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">
                  {adapter?.label} will not work until you set a proxy URL.
                </p>
                <p>
                  This gateway refuses browser calls. Measured on a government workstation: the
                  network path is healthy, and the server sends no CORS headers, so the browser
                  discards the answer before your key is ever presented. No setting in this app
                  changes that.
                </p>
                {edmsLocked && (
                  <p className="text-red-600 dark:text-red-400">
                    EDMS mode restricts GunnyBot to this provider, so GunnyBot stays unavailable for
                    this draft until the proxy is running. Switching providers is not permitted here.
                  </p>
                )}
                <p>
                  Run the SemperScribe local proxy, then paste its address below. Prefer the
                  127.0.0.1 form over localhost.
                </p>
              </div>
            </div>
          )}

          {proxySaved !== null && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 font-mono text-[10px]">
                <Server className="w-3 h-3 mr-1" /> {proxySaved}
              </Badge>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleClearProxy}>Clear proxy</Button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={proxyInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProxyInput(e.target.value)}
              placeholder={proxySaved !== null ? 'Replace the proxy URL...' : 'http://127.0.0.1:8443'}
              autoComplete="off"
              spellCheck={false}
              className="bg-background border-input font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleSaveProxy} disabled={proxyInput.trim().length === 0}>
              <Server className="w-3 h-3 mr-1" /> Save proxy
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Requests go to this address instead of the provider. The proxy runs on your machine, holds
            no key, and forwards the one you set below. It is not a secret, so unlike your key it is
            remembered across reloads.
          </p>
        </div>
      )}

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
        <Button variant="outline" size="sm" onClick={handleTest} disabled={!keyPresent || testing || proxyMissing}>
          {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
          Test connection
        </Button>
        {proxyMissing && keyPresent && (
          <p className="text-[10px] text-muted-foreground">
            Test connection is unavailable until the proxy URL is set. Sending now would fail with an
            unreadable browser error rather than tell you anything.
          </p>
        )}
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
