// @vitest-environment node
/**
 * The body cap and the render timeout. Both are the only thing standing
 * between a loopback caller and an unbounded process, so both are tested
 * against real bytes and a real timer rather than a mocked clock.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { CompanionError } from '../../companion/errors';
import {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_TIMEOUT_MS,
  maxBodyBytes,
  readBodyWithCap,
  renderTimeoutMs,
  withTimeout,
} from '../../companion/limits';

const ENV_KEYS = ['COMPANION_MAX_BODY', 'COMPANION_TIMEOUT_MS'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

async function* chunks(...parts: string[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) {
    yield Buffer.from(part);
  }
}

function sleep(ms: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve('slow'), ms));
}

describe('limit configuration', () => {
  it('defaults to two megabytes and forty five seconds', () => {
    expect(maxBodyBytes()).toBe(DEFAULT_MAX_BODY_BYTES);
    expect(DEFAULT_MAX_BODY_BYTES).toBe(2 * 1024 * 1024);
    expect(renderTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
    expect(DEFAULT_TIMEOUT_MS).toBe(45_000);
  });

  it('reads the environment overrides', () => {
    process.env.COMPANION_MAX_BODY = '4096';
    process.env.COMPANION_TIMEOUT_MS = '1500';
    expect(maxBodyBytes()).toBe(4096);
    expect(renderTimeoutMs()).toBe(1500);
  });

  it('ignores an override which is not a positive integer', () => {
    process.env.COMPANION_MAX_BODY = 'lots';
    process.env.COMPANION_TIMEOUT_MS = '-5';
    expect(maxBodyBytes()).toBe(DEFAULT_MAX_BODY_BYTES);
    expect(renderTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
  });
});

describe('readBodyWithCap', () => {
  it('returns the whole body when it fits', async () => {
    const body = await readBodyWithCap(chunks('{"a":', '1}'), 64);
    expect(body.toString('utf8')).toBe('{"a":1}');
  });

  it('refuses the body the moment the running total passes the cap', async () => {
    let delivered = 0;
    async function* counted(): AsyncGenerator<Uint8Array> {
      for (let i = 0; i < 10; i++) {
        delivered += 1;
        yield Buffer.alloc(8, 0x61);
      }
    }
    await expect(readBodyWithCap(counted(), 16)).rejects.toThrowError(CompanionError);
    // Two chunks of eight fit the cap; the third crosses it and stops the read.
    expect(delivered).toBe(3);
  });

  it('reports the cap in a 413', async () => {
    try {
      await readBodyWithCap(chunks('x'.repeat(100)), 10);
      throw new Error('expected the body to be refused');
    } catch (error) {
      const companion = error as CompanionError;
      expect(companion.code).toBe('body_too_large');
      expect(companion.status).toBe(413);
      expect(companion.details.cap).toBe(10);
    }
  });
});

describe('withTimeout', () => {
  it('passes work through when it finishes first', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1000, 'Render')).resolves.toBe('done');
  });

  it('passes a rejection through unchanged', async () => {
    const boom = new Error('pipeline blew up');
    await expect(withTimeout(Promise.reject(boom), 1000, 'Render')).rejects.toBe(boom);
  });

  it('rejects with a 504 when the timer wins the race', async () => {
    const started = Date.now();
    try {
      await withTimeout(sleep(5000), 25, 'Render');
      throw new Error('expected the timeout to win');
    } catch (error) {
      const companion = error as CompanionError;
      expect(companion.code).toBe('timeout');
      expect(companion.status).toBe(504);
      expect(companion.details.timeoutMs).toBe(25);
      // A real timer, not an after-the-fact check: the wait is the timeout,
      // not the five seconds the abandoned work still takes.
      expect(Date.now() - started).toBeLessThan(2000);
    }
  });
});
