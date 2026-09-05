/**
 * One error shape for the companion.
 *
 * Every failure the HTTP surface reports and every failure the MCP tools
 * report comes from here, so a caller sees the same machine-readable
 * `code` whichever door it came through. `status` is the HTTP status the
 * server sends; the MCP side ignores it and reports the code and message.
 *
 * `details` carries the structured payload a caller needs to act on: the
 * sensitive-data findings for a refused render, the validator output for
 * a rejected document.
 */
export type CompanionErrorCode =
  | 'bad_request'
  | 'body_too_large'
  | 'unsupported_media_type'
  | 'unknown_document_type'
  | 'format_not_supported'
  | 'validation_failed'
  | 'sensitive_data'
  | 'output_not_configured'
  | 'output_path_rejected'
  | 'timeout'
  | 'not_found'
  | 'method_not_allowed'
  | 'internal_error';

export class CompanionError extends Error {
  readonly code: CompanionErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: CompanionErrorCode,
    status: number,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CompanionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** JSON body for an error response. Shared by the routes and the tools. */
export function errorPayload(error: unknown): {
  error: CompanionErrorCode;
  message: string;
  details: Record<string, unknown>;
} {
  if (error instanceof CompanionError) {
    return { error: error.code, message: error.message, details: error.details };
  }
  return {
    error: 'internal_error',
    message: error instanceof Error ? error.message : String(error),
    details: {},
  };
}

/** HTTP status for any thrown value. Anything unrecognised is a 500. */
export function errorStatus(error: unknown): number {
  return error instanceof CompanionError ? error.status : 500;
}
