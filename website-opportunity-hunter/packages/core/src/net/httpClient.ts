import { AppError } from '../domain/errors.js';
import { logger } from '../logging/logger.js';
import { getCircuitBreaker } from './circuitBreaker.js';
import { RateLimiter } from './rateLimiter.js';

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Cap on the response body. Protects the analyzer from multi-MB pages. */
  maxBytes?: number;
  /** Status codes that should be surfaced rather than retried, e.g. 404. */
  expectedStatuses?: number[];
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  url: string;
  text: string;
  durationMs: number;
  truncated: boolean;
}

export interface HttpClientOptions {
  name: string;
  rateLimiter?: RateLimiter;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  defaultTimeoutMs?: number;
  defaultMaxBytes?: number;
  userAgent?: string;
  /** Injected for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Called after every attempt, for the api_usage table. */
  onCall?: (info: {
    provider: string;
    endpoint: string;
    status?: number;
    ok: boolean;
    durationMs: number;
  }) => void;
  circuitBreaker?: { failureThreshold: number; resetTimeoutMs: number } | false;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Full jitter exponential backoff — avoids synchronised retry storms. */
export function backoffDelay(attempt: number, baseMs: number, maxMs: number, rand = Math.random): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(rand() * exponential);
}

/** Reads at most `maxBytes` from the body, aborting the stream past the cap. */
async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: await res.text(), truncated: false };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(decoder.decode(value.subarray(0, value.byteLength - (total - maxBytes)), { stream: false }));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return { text: chunks.join(''), truncated };
}

/**
 * The single outbound HTTP path for the whole system: timeouts, capped bodies,
 * exponential backoff with jitter, a shared rate limiter and a circuit breaker.
 *
 * Nothing here tries to look like a browser or work around a block. A 401, 403
 * or a CAPTCHA page is a final answer: we record it and move to another
 * permitted source.
 */
export class HttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: HttpClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  }

  async request(req: HttpRequest): Promise<HttpResponse> {
    const breakerCfg = this.opts.circuitBreaker;
    if (breakerCfg === false) return this.attemptWithRetries(req);
    const breaker = getCircuitBreaker(
      this.opts.name,
      breakerCfg?.failureThreshold ?? 5,
      breakerCfg?.resetTimeoutMs ?? 60_000,
    );
    return breaker.run(() => this.attemptWithRetries(req));
  }

  private async attemptWithRetries(req: HttpRequest): Promise<HttpResponse> {
    const maxRetries = this.opts.maxRetries ?? 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.attempt(req);
      } catch (err) {
        lastError = err;
        const retryable = err instanceof AppError && err.retryable;
        if (!retryable || attempt === maxRetries) break;
        const delay = backoffDelay(
          attempt,
          this.opts.baseDelayMs ?? 500,
          this.opts.maxDelayMs ?? 8_000,
        );
        logger.warn('http.retry', `${this.opts.name}: retrying after failure`, {
          // safeEndpoint, never the raw URL: some providers carry the API key
          // in the query string.
          url: safeEndpoint(req.url),
          attempt: attempt + 1,
          delayMs: delay,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delay);
      }
    }
    throw lastError;
  }

  private async attempt(req: HttpRequest): Promise<HttpResponse> {
    if (this.opts.rateLimiter) await this.opts.rateLimiter.acquire();

    const timeoutMs = req.timeoutMs ?? this.opts.defaultTimeoutMs ?? 15_000;
    const maxBytes = req.maxBytes ?? this.opts.defaultMaxBytes ?? 5_000_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const endpoint = safeEndpoint(req.url);

    try {
      const res = await this.fetchImpl(req.url, {
        method: req.method ?? 'GET',
        headers: {
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'en-GB,en;q=0.9',
          ...(this.opts.userAgent ? { 'user-agent': this.opts.userAgent } : {}),
          ...req.headers,
        },
        ...(req.body !== undefined ? { body: req.body } : {}),
        signal: controller.signal,
        redirect: 'follow',
      });

      const { text, truncated } = await readCapped(res, maxBytes);
      const durationMs = Date.now() - startedAt;
      this.opts.onCall?.({
        provider: this.opts.name,
        endpoint,
        status: res.status,
        ok: res.ok,
        durationMs,
      });

      const expected = req.expectedStatuses ?? [];
      if (!res.ok && !expected.includes(res.status)) {
        throw new AppError('HTTP_ERROR', `${this.opts.name}: HTTP ${res.status} for ${endpoint}`, {
          retryable: RETRYABLE_STATUS.has(res.status),
          status: res.status,
          context: { url: endpoint, snippet: text.slice(0, 300) },
        });
      }

      return {
        status: res.status,
        ok: res.ok,
        headers: res.headers,
        url: res.url || req.url,
        text,
        durationMs,
        truncated,
      };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      if (err instanceof AppError) {
        if (err.code !== 'HTTP_ERROR') {
          this.opts.onCall?.({ provider: this.opts.name, endpoint, ok: false, durationMs });
        }
        throw err;
      }
      this.opts.onCall?.({ provider: this.opts.name, endpoint, ok: false, durationMs });
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AppError('TIMEOUT', `${this.opts.name}: timed out after ${timeoutMs}ms`, {
          retryable: true,
          context: { url: endpoint },
          cause: err,
        });
      }
      throw new AppError('PROVIDER_UNAVAILABLE', `${this.opts.name}: ${(err as Error).message}`, {
        retryable: true,
        context: { url: endpoint },
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Strip query strings before logging: they routinely carry API keys. */
export function safeEndpoint(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}
