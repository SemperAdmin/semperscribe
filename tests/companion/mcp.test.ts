// @vitest-environment node
/**
 * The MCP surface, spoken to the way an agent runner speaks to it: the
 * process is spawned, the handshake runs, and the tools are called over
 * stdio with the SDK's own client.
 *
 * This is the test which catches a protocol-level break, such as writing
 * anything but protocol traffic to stdout.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createNLDPFile } from '@/lib/nldp-utils';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from '../golden/fixture';

const repoRoot = process.cwd();
const tsxBin = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

let client: Client;

/** The tools answer with one JSON text block. */
function parsed(result: unknown): Record<string, unknown> {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  expect(content[0].type).toBe('text');
  return JSON.parse(content[0].text ?? '{}');
}

beforeAll(async () => {
  client = new Client({ name: 'companion-test', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: tsxBin,
      args: [path.join('companion', 'mcp.ts')],
      cwd: repoRoot,
      stderr: 'ignore',
    }),
  );
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('companion MCP server', () => {
  it('advertises the four tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_document_schema',
      'list_document_types',
      'render_document',
      'validate_document',
    ]);
  });

  it('answers list_document_types', async () => {
    const body = parsed(await client.callTool({ name: 'list_document_types', arguments: {} }));
    const types = body.documentTypes as Array<{ id: string }>;
    expect(types.length).toBeGreaterThan(20);
    expect(types.map((t) => t.id)).toContain('basic');
  });

  it('answers validate_document for a well-formed package', async () => {
    const document = await createNLDPFile(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
    );
    const body = parsed(
      await client.callTool({
        name: 'validate_document',
        arguments: { document: document as unknown as Record<string, unknown> },
      }),
    );
    expect(body.ok).toBe(true);
    expect(body.documentType).toBe('basic');
    expect(body.errors).toEqual([]);
  }, 60000);

  /**
   * AUDIT P2-10. The EDMS context reaches the returned filename, so the
   * tool schema carries the same shapes the EDMS handoff link accepts and
   * the SDK refuses a request that fails them before the tool runs.
   */
  it('advertises the EDMS field patterns in the render_document schema', async () => {
    const { tools } = await client.listTools();
    const render = tools.find((t) => t.name === 'render_document');
    const edms = (render?.inputSchema as { properties: Record<string, { properties?: Record<string, { pattern?: string }> }> })
      .properties.edms;
    expect(edms.properties?.requestId.pattern).toBeDefined();
    expect(new RegExp(edms.properties?.requestId.pattern ?? '').test('../x')).toBe(false);
    expect(new RegExp(edms.properties?.requestId.pattern ?? '').test('482')).toBe(true);
    for (const field of ['ruc', 'ssic', 'docType', 'section']) {
      expect(edms.properties?.[field].pattern, field).toBeDefined();
    }
  });

  it('refuses render_document when edms.requestId carries a path', async () => {
    const document = await createNLDPFile(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
    );
    let outcome: 'threw' | 'errored' | 'rendered' = 'rendered';
    let text = '';
    try {
      const result = await client.callTool({
        name: 'render_document',
        arguments: {
          document: document as unknown as Record<string, unknown>,
          format: 'pdf',
          edms: { requestId: '../x', ruc: '12345', ssic: '1000', docType: 'basic' },
        },
      });
      if ((result as { isError?: boolean }).isError) {
        outcome = 'errored';
        text = JSON.stringify(result);
      }
    } catch (error) {
      outcome = 'threw';
      text = (error as Error).message;
    }
    expect(outcome).not.toBe('rendered');
    expect(text).toMatch(/requestId/);
    expect(text).not.toMatch(/base64/);
  }, 60000);

  it('reports a bad package as a tool result, not a transport failure', async () => {
    const body = parsed(
      await client.callTool({
        name: 'validate_document',
        arguments: { document: { format: 'NOPE' } },
      }),
    );
    expect(body.ok).toBe(false);
    expect((body.errors as string[]).length).toBeGreaterThan(0);
  });
});
