import type { GunnyRequest, GunnyStreamEvent } from './types';
import { getAdapter } from './providers';

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
  const adapter = getAdapter(req.provider);
  if (adapter === null) {
    handlers.onEvent({
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
      handlers.onEvent({ kind: 'done', stopReason: 'aborted' });
      return;
    }
    handlers.onEvent({ kind: 'error', message: safeError(err, req.apiKey) });
    return;
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    const suffix = detail.length > 0 ? ': ' + truncate(redact(detail, req.apiKey), 500) : '';
    handlers.onEvent({ kind: 'error', message: 'HTTP ' + res.status + suffix });
    return;
  }

  const body = res.body;
  if (!body) {
    handlers.onEvent({ kind: 'error', message: 'Provider returned no response stream.' });
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
      // Strip CR so both LF and CRLF frame on a blank line.
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r/g, '');
      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        emitBlock(adapter, block, handlers);
        sep = buffer.indexOf('\n\n');
      }
    }
    // Flush any trailing event with no closing blank line.
    if (buffer.length > 0) {
      emitBlock(adapter, buffer, handlers);
    }
  } catch (err) {
    if (isAbort(err)) {
      handlers.onEvent({ kind: 'done', stopReason: 'aborted' });
      return;
    }
    handlers.onEvent({ kind: 'error', message: safeError(err, req.apiKey) });
  }
}

function emitBlock(
  adapter: { parseStreamChunk(raw: string): GunnyStreamEvent[] },
  block: string,
  handlers: StreamHandlers,
): void {
  const data = extractSseData(block);
  if (data === null) {
    return;
  }
  const events = adapter.parseStreamChunk(data);
  for (const event of events) {
    handlers.onEvent(event);
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
  return redact(raw, key);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}
