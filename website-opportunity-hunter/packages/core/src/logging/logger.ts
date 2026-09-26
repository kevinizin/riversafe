/**
 * Structured logging. Every line is JSON with a stable `event` name so the
 * System Health screens can aggregate without parsing prose.
 *
 * Persisting to the `system_logs` table is opt-in via `setLogSink` — core stays
 * usable in unit tests with no database.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LogRecord {
  level: LogLevel;
  event: string;
  message: string;
  jobId?: string;
  companyId?: string;
  context?: Record<string, unknown>;
  at: Date;
}

export type LogSink = (record: LogRecord) => void | Promise<void>;

let sink: LogSink | null = null;
let threshold: LogLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

export function setLogSink(next: LogSink | null): void {
  sink = next;
}

export function setLogLevel(level: LogLevel): void {
  threshold = level;
}

/** Redact anything that looks like a credential before it reaches a log line. */
const SECRET_KEYS = /(key|token|secret|password|authorization|apikey)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function emit(record: LogRecord): void {
  if (LEVEL_ORDER[record.level] < LEVEL_ORDER[threshold]) return;
  const line = {
    ts: record.at.toISOString(),
    level: record.level,
    event: record.event,
    msg: record.message,
    ...(record.jobId ? { jobId: record.jobId } : {}),
    ...(record.companyId ? { companyId: record.companyId } : {}),
    ...(record.context ? { ctx: redact(record.context) } : {}),
  };
  const text = JSON.stringify(line);
  if (record.level === 'error') console.error(text);
  else if (record.level === 'warn') console.warn(text);
  else console.log(text);

  if (sink) {
    void Promise.resolve(sink(record)).catch(() => {
      /* logging must never break the caller */
    });
  }
}

export interface Logger {
  debug(event: string, message: string, context?: Record<string, unknown>): void;
  info(event: string, message: string, context?: Record<string, unknown>): void;
  warn(event: string, message: string, context?: Record<string, unknown>): void;
  error(event: string, message: string, context?: Record<string, unknown>): void;
  child(bindings: { jobId?: string; companyId?: string }): Logger;
}

export function createLogger(bindings: { jobId?: string; companyId?: string } = {}): Logger {
  const write = (level: LogLevel) =>
    (event: string, message: string, context?: Record<string, unknown>) =>
      emit({ level, event, message, at: new Date(), ...bindings, ...(context ? { context } : {}) });

  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();
