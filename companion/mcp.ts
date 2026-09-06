/**
 * The companion's MCP surface: the same four operations as the HTTP
 * routes, exposed to an agent over stdio.
 *
 * stdio is the whole transport. There is no port, no listener, and no
 * network of any kind: the client spawns this process and talks to it
 * over its own pipes, so the security posture is whatever the client
 * already had. Nothing is written to stdout except protocol traffic,
 * which is why the startup line goes to stderr.
 *
 * render_document returns the written path when `out` is given and the
 * base64 of the file otherwise. Base64 of a naval letter runs to a few
 * hundred kilobytes of text, which is a large amount of an agent's
 * context, so the response carries a warning saying so and pointing at
 * `out`.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { version as APP_VERSION } from '../package.json';
import type { EdmsContext } from '@/lib/edms-mode';
import { errorPayload } from './errors';
import { renderTimeoutMs, withTimeout } from './limits';
import { outputDir, writeOutput } from './output';
import {
  getDocumentSchema,
  listDocumentTypes,
  renderDocument,
  validateDocument,
  type CompanionFormat,
} from './handler';

/** Base64 above this many bytes gets the context warning. */
const LARGE_BASE64_BYTES = 256 * 1024;

const documentSchema = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe('An NLDP package: the parsed object, or the JSON text of one.');

const edmsSchema = z
  .object({
    requestId: z.string().optional(),
    ruc: z.string(),
    ssic: z.string(),
    docType: z.string(),
    section: z.string().optional(),
  })
  .describe('EDMS context. Present means the file takes the EDMS name convention.');

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function failure(error: unknown) {
  return textResult(errorPayload(error), true);
}

export function createCompanionMcpServer(): McpServer {
  const server = new McpServer({ name: 'semperscribe', version: APP_VERSION });

  server.registerTool(
    'list_document_types',
    {
      title: 'List document types',
      description:
        'Every SemperScribe document type with the formats it exports. Use the ' +
        'id from this list as data.formData.documentType in an NLDP package.',
      inputSchema: {},
    },
    async () => {
      try {
        return textResult({ documentTypes: listDocumentTypes() });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get_document_schema',
    {
      title: 'Get document schema',
      description:
        'The NLDP envelope plus a JSON Schema for the formData a given ' +
        'document type accepts, generated from the application schema, with ' +
        'the editor field labels alongside it.',
      inputSchema: {
        type: z.string().describe('Document type id, e.g. "basic" or "mco".'),
      },
    },
    async ({ type }) => {
      try {
        return textResult(getDocumentSchema(type));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'validate_document',
    {
      title: 'Validate a document',
      description:
        'Checks an NLDP package: structure, integrity, and the naval letter ' +
        'rules. Returns errors, warnings, and the sensitive-data findings a ' +
        'render would refuse on.',
      inputSchema: { document: documentSchema },
    },
    async ({ document }) => {
      try {
        return textResult(
          await withTimeout(validateDocument(document), renderTimeoutMs(), 'Validation'),
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'render_document',
    {
      title: 'Render a document',
      description:
        'Renders an NLDP package to PDF or DOCX. Returns the written path ' +
        'when out is given, otherwise the file as base64. A document with ' +
        'sensitive-data findings is refused unless acknowledgeSensitive is true.',
      inputSchema: {
        document: documentSchema,
        format: z.enum(['pdf', 'docx']),
        out: z
          .string()
          .optional()
          .describe(
            'File name under COMPANION_OUT_DIR. Paths outside it are refused. ' +
              'Without it the file comes back as base64.',
          ),
        acknowledgeSensitive: z
          .boolean()
          .optional()
          .describe('Proceed even though the sensitive-data scan found something.'),
        edms: edmsSchema.optional(),
      },
    },
    async ({ document, format, out, acknowledgeSensitive, edms }) => {
      try {
        const result = await withTimeout(
          renderDocument({
            document,
            format: format as CompanionFormat,
            edms: edms as EdmsContext | undefined,
            acknowledgeSensitive: acknowledgeSensitive === true,
          }),
          renderTimeoutMs(),
          'Render',
        );
        const common = {
          filename: result.filename,
          contentType: result.contentType,
          documentType: result.documentType,
          bytes: result.bytes.byteLength,
          findings: result.findings,
        };
        if (typeof out === 'string' && out !== '') {
          return textResult({ ...common, path: await writeOutput(out, result.bytes) });
        }
        const base64 = Buffer.from(result.bytes).toString('base64');
        const warning =
          result.bytes.byteLength >= LARGE_BASE64_BYTES
            ? `This file is ${result.bytes.byteLength} bytes and its base64 is about ` +
              `${Math.round((base64.length / 1024))} KB of text. Set COMPANION_OUT_DIR and ` +
              'pass out to get a path back instead.'
            : undefined;
        return textResult({
          ...common,
          ...(warning ? { warning } : {}),
          ...(outputDir() === null ? { outDirConfigured: false } : {}),
          base64,
        });
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

export async function startCompanionMcpServer(): Promise<void> {
  const server = createCompanionMcpServer();
  await server.connect(new StdioServerTransport());
  process.stderr.write(`SemperScribe companion MCP server ${APP_VERSION} ready on stdio\n`);
}

const entry = process.argv[1] ?? '';
if (/companion[\\/]mcp\.ts$/.test(entry)) {
  void startCompanionMcpServer().catch((error) => {
    process.stderr.write(`Companion MCP server failed to start: ${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
