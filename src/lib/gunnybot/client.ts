import type { GunnyRequest, GunnyStreamEvent } from './types';
import { getAdapter } from './providers';
import { isEdmsMode, EDMS_ALLOWED_PROVIDER } from '@/lib/edms-mode';

export interface StreamHandlers {
  onEvent(event: GunnyStreamEvent): void;
  signal?: AbortSignal;
}

/**
 * Single entry point for a chat turn. Sends the adapter-built request,
 * frames the SSE response, and emits GunnyStreamEvents. Stop rides the
 * AbortSignal. The user's key never appears in an emitted error.
 */
export async function streamChat(req: GunnyRequest, handlers: StreamHandlers): Promise<void> {
  // A successful HTTP response carrying nothing usable is a failure, and
  // it used to end this function in silence. Every emit runs through the
  // counter so the tail guard below reports the dead case instead.
  let emitted = 0;
  const emit = (event: GunnyStreamEvent): void => {
    emitted += 1;
    handlers.onEvent(event);
  };

  // EDMS egress restriction.
  //
  // While EDMS mode is active the draft is bound for a DoD IL5 records
  // system. Egress is restricted to GenAI.mil. The check lives HERE, not
  // in GunnyBotSettings, because this function is the only place
  // GunnyBot calls fetch. Every caller passes through it: draft,
  // rewrite, proofread, QA, and the Test connection probe. A default in
  // the settings UI is a preference, not a control.
  //
  // Fail closed. An unrecognised provider is blocked, not allowed.
  if (isEdmsMode() && req.provider !== EDMS_ALLOWED_PROVIDER) {
    emit({
      kind: 'error',
      message:
        'Blocked. This draft is bound for an EDMS request, so GunnyBot is restricted to ' +
        'GenAI.mil. Switch the provider to GenAI.mil in Settings, or draft outside EDMS ' +
        'in a new tab.',
    });
    return;
  }

  const adapter = getAdapter(req.provider);
  if (adapter === null) {
    emit({
      kind: 'error',
      message: 'Provider ' + req.provider + ' has no browser-direct adapter. Configure a proxy first.',
    });
    return;
  }

  const httpReq = adapter.buildRequest(req);

  let res: Response;
  try {
    res = await fetch(httpReq.url, {
      method: 'POST',
      headers: httpReq.headers,
      body: httpReq.body,
      signal: handlers.signal,
    });
  } catch (err) {
    if (isAbort(err)) {
      emit({ kind: 'done', stopReason: 'aborted' });
      return;
    }
    emit({ kind: 'error', message: safeError(err, req.apiKey) });
    return;
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    emit({ kind: 'error', message: summarizeHttpError(res.status, detail, req.apiKey) });
    return;
  }

  const contentType = res.headers.get('content-type') ?? 'unknown';
  let bytesRead = 0;

  // Non-streaming providers (GenAI.mil) return one JSON object, not SSE.
  if (adapter.streaming === false && adapter.parseFullResponse) {
    let raw = '';
    try {
      raw = await res.text();
    } catch {
      emit({ kind: 'error', message: 'Provider returned an unreadable response body.' });
      return;
    }
    bytesRead = raw.length;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      emit({ kind: 'error', message: 'Provider returned a non-JSON response.' });
      return;
    }
    for (const event of adapter.parseFullResponse(json)) {
      emit(event);
    }
    if (emitted === 0) {
      emit({ kind: 'error', message: describeSilentResponse(res.status, contentType, bytesRead) });
    }
    return;
  }

  const body = res.body;
  if (!body) {
    emit({ kind: 'error', message: 'Provider returned no response stream.' });
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      bytesRead += chunk.value.length;
      // Strip CR so both LF and CRLF frame on a blank line.
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r/g, '');
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        emitBlock(adapter, block, emit);
        sep = buffer.indexOf('\n\n');
      }
    }
    // Flush any trailing event with no closing blank line.
    if (buffer.length > 0) {
      emitBlock(adapter, buffer, emit);
    }
  } catch (err) {
    if (isAbort(err)) {
      emit({ kind: 'done', stopReason: 'aborted' });
      return;
    }
    emit({ kind: 'error', message: safeError(err, req.apiKey) });
    return;
  }

  if (emitted === 0) {
    emit({ kind: 'error', message: describeSilentResponse(res.status, contentType, bytesRead) });
  }
}

/**
 * Turns a 2xx response carrying nothing usable into a message naming what
 * came back. Measured case: gemini-2.5-flash with maxOutputTokens 16
 * returns HTTP 200, content-type text/event-stream, and a zero-byte body
 * once reasoning tokens consume the whole allowance.
 */
function describeSilentResponse(status: number, contentType: string, bytes: number): string {
  const shape =
    bytes === 0
      ? 'an empty body'
      : bytes + ' bytes carrying no readable content';
  return (
    'Provider returned HTTP ' +
    status +
    ' with ' +
    shape +
    ' (content-type ' +
    contentType +
    '). A short output token budget consumed entirely by server-side reasoning is the common cause. Raise the token limit, or pick a model without reasoning.'
  );
}

function emitBlock(
  adapter: { parseStreamChunk(raw: string): GunnyStreamEvent[] },
  block: string,
  emit: (event: GunnyStreamEvent) => void,
): void {
  const data = extractSseData(block);
  if (data === null) {
    return;
  }
  const events = adapter.parseStreamChunk(data);
  for (const event of events) {
    emit(event);
  }
}

// Collect the data field of one SSE event. Ignores event: and comment
// lines. Returns null when the block carries no data line.
function extractSseData(block: string): string | null {
  const lines = block.split('\n');
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const value = line.slice(5);
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return dataLines.join('\n');
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

function redact(text: string, key: string): string {
  if (key.length === 0) {
    return text;
  }
  return text.split(key).join('[redacted-key]');
}

function safeError(err: unknown, key: string): string {
  const raw =
    typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : String(err);
  const redacted = redact(raw, key);
  const lower = redacted.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'Could not reach the provider. This is usually a network block or a CORS restriction. (' + redacted + ')';
  }
  return redacted;
}

// Turns a non-2xx response into a short reason plus the provider's own
// message, with the key redacted. Google, OpenAI, and Anthropic error
// bodies all nest a message under `error`.
function summarizeHttpError(status: number, body: string, key: string): string {
  const redacted = redact(body, key);
  let providerMessage = '';
  let reason = '';
  try {
    const json = JSON.parse(redacted);
    const err = json?.error ?? json;
    if (typeof err?.message === 'string') {
      providerMessage = err.message;
    }
    if (typeof err?.status === 'string') {
      reason = err.status;
    }
    const details = err?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d && typeof d.reason === 'string') {
          reason = d.reason;
          break;
        }
      }
    }
    if (reason.length === 0 && typeof err?.type === 'string') {
      reason = err.type;
    }
  } catch {
    // Body is not JSON. The status label carries the message.
  }
  const label = shortLabel(status, reason + ' ' + providerMessage);
  const detail = providerMessage.length > 0 ? '. ' + truncate(providerMessage, 240) : '';
  return label + ' (HTTP ' + status + ')' + detail;
}

function shortLabel(status: number, hint: string): string {
  const h = hint.toLowerCase();
  if (
    h.includes('api_key_invalid') ||
    h.includes('api key not valid') ||
    h.includes('invalid api key') ||
    h.includes('unauthenticated') ||
    status === 401 ||
    status === 403
  ) {
    return 'API key invalid or not authorized';
  }
  if (h.includes('quota') || h.includes('rate limit') || h.includes('rate_limit') || status === 429) {
    return 'Rate limit or quota exceeded';
  }
  if (h.includes('model') && (h.includes('not found') || h.includes('does not exist') || h.includes('permission'))) {
    return 'Model not available for this key';
  }
  if (status === 404) {
    return 'Not found';
  }
  if (status === 400) {
    return 'Bad request, check the model ID and key';
  }
  if (status >= 500) {
    return 'Provider server error';
  }
  return 'Request failed';
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}
