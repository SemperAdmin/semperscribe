/**
 * The two limits the companion enforces on every request.
 *
 * Body cap. A render request carries one NLDP document, which is JSON
 * text. Two megabytes is roughly forty times the largest document the
 * app produces, and the cap exists so a caller cannot hold the process
 * open streaming an unbounded body. Override with COMPANION_MAX_BODY
 * (bytes).
 *
 * Render timeout. The PDF and DOCX pipelines are synchronous CPU work
 * once they start, but a malformed document pushes the paginator into a
 * long run. Forty five seconds is the ceiling, overridable with
 * COMPANION_TIMEOUT_MS. The race is a real timer, not an accounting
 * check after the fact, so a caller gets its 504 while the work is still
 * running rather than after it finishes.
 *
 * Note what the timeout does NOT do: Node has no way to cancel work
 * already inside a pipeline, so the abandoned render keeps burning CPU
 * until it returns. The timeout bounds the caller's wait, not the
 * process's load.
 */
import { CompanionError } from './errors';

export const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 45_000;

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/** Largest request body the server reads before it answers 413. */
export function maxBodyBytes(): number {
  return positiveIntFromEnv('COMPANION_MAX_BODY', DEFAULT_MAX_BODY_BYTES);
}

/** Wall-clock ceiling on one render, in milliseconds. */
export function renderTimeoutMs(): number {
  return positiveIntFromEnv('COMPANION_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
}

/**
 * Races a promise against a real timer. Rejects with a 504 CompanionError
 * when the timer wins, and always clears the timer so a finished render
 * never holds the event loop open.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new CompanionError('timeout', 504, `${label} exceeded ${ms} ms`, { timeoutMs: ms }));
    }, ms);
  });
  return Promise.race([work, expiry]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Reads a request body with a hard cap. Counts bytes as chunks arrive and
 * throws a 413 CompanionError the moment the running total passes the
 * cap, so an oversized body is refused without being buffered whole.
 *
 * Takes any async iterable of chunks, which is what http.IncomingMessage
 * is, so the cap is testable without a socket.
 */
export async function readBodyWithCap(
  chunks: AsyncIterable<Uint8Array | string>,
  cap: number = maxBodyBytes(),
): Promise<Buffer> {
  const parts: Buffer[] = [];
  let total = 0;
  for await (const chunk of chunks) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    total += buf.byteLength;
    if (total > cap) {
      throw new CompanionError(
        'body_too_large',
        413,
        `Request body exceeds the ${cap} byte cap`,
        { cap },
      );
    }
    parts.push(buf);
  }
  return Buffer.concat(parts);
}
