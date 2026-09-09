/**
 * Audit 2026-09-08 finding 1: the deployed static app set no HTTP
 * security headers. The fix is deploy-config, not app code, so it has no
 * runtime to unit-test. This guard asserts the config ships and stays
 * wired, so a refactor that drops public/Staticfile or the includes file,
 * or moves them out of the path next build copies, fails here instead of
 * silently shipping a bare site.
 *
 * Live headers are still verified out of band with `curl -sSI` against
 * the cloud.gov host; this only proves the source of those headers exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PUBLIC = path.join(process.cwd(), 'public');
const staticfile = () => readFileSync(path.join(PUBLIC, 'Staticfile'), 'utf8');
const headers = () =>
  readFileSync(path.join(PUBLIC, 'nginx', 'conf', 'includes', 'security-headers.conf'), 'utf8');

describe('cloud.gov Staticfile', () => {
  it('lives in public/ so next build copies it to the export root', () => {
    expect(() => staticfile()).not.toThrow();
  });

  it('forces HTTPS and wires the header includes into location /', () => {
    const s = staticfile();
    expect(s).toMatch(/force_https:\s*true/);
    expect(s).toMatch(/location_include:\s*includes\/\*\.conf/);
  });
});

describe('security-headers.conf', () => {
  it('lives under nginx/conf/includes so location_include finds it', () => {
    expect(() => headers()).not.toThrow();
  });

  it('sets every required header, each with always', () => {
    const h = headers();
    const required = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ];
    for (const name of required) {
      const line = h.split('\n').find((l) => l.includes(`add_header ${name} `));
      expect(line, `missing add_header for ${name}`).toBeDefined();
      expect(line, `${name} must be set with always`).toMatch(/always;\s*$/);
    }
  });

  it('denies framing and MIME sniffing outright', () => {
    const h = headers();
    expect(h).toMatch(/frame-ancestors 'none'/);
    expect(h).toMatch(/X-Frame-Options "DENY"/);
    expect(h).toMatch(/X-Content-Type-Options "nosniff"/);
  });

  it('scopes connect-src to self, the AI hosts and loopback, nothing wider', () => {
    const h = headers();
    const csp = h.split('\n').find((l) => l.includes('Content-Security-Policy')) ?? '';
    const connect = /connect-src ([^;]+);/.exec(csp)?.[1] ?? '';
    expect(connect).toContain("'self'");
    // pdfjs consumers take the Blob object, so connect-src needs no blob:
    expect(connect).not.toContain('blob:');
    expect(connect).toContain('https://generativelanguage.googleapis.com');
    expect(connect).toContain('https://api.genai.mil');
    expect(connect).toContain('http://127.0.0.1:*');
    // No wildcard host and no plaintext-anywhere allowance.
    expect(connect).not.toMatch(/(^|\s)\*(\s|$)/);
    expect(connect).not.toContain('http://*');
  });

  it('allows the blob frames and workers the PDF preview needs', () => {
    const h = headers();
    expect(h).toMatch(/frame-src 'self' blob:/);
    expect(h).toMatch(/worker-src 'self' blob:/);
  });

  it("allows WebAssembly for react-pdf's layout engine without general eval", () => {
    const h = headers();
    const csp = h.split('\n').find((l) => l.includes('Content-Security-Policy')) ?? '';
    const script = /script-src ([^;]+);/.exec(csp)?.[1] ?? '';
    expect(script).toContain("'wasm-unsafe-eval'");
    // The broad eval allowance stays out.
    expect(script).not.toContain("'unsafe-eval'");
  });
});
