/** Errors carry a machine-readable code so the pipeline can decide, per stage,
 *  whether to retry, skip, or mark a stage UNAVAILABLE without losing the lead. */

export type ErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'CIRCUIT_OPEN'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'ROBOTS_DISALLOWED'
  | 'RESPONSE_TOO_LARGE'
  | 'INVALID_RESPONSE'
  | 'BUDGET_EXCEEDED'
  | 'NOT_FOUND'
  | 'VALIDATION';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { retryable?: boolean; status?: number; context?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.status = opts.status;
    this.context = opts.context;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

export function describeError(e: unknown): { code: string; message: string } {
  if (isAppError(e)) return { code: e.code, message: e.message };
  if (e instanceof Error) return { code: 'UNKNOWN', message: e.message };
  return { code: 'UNKNOWN', message: String(e) };
}
