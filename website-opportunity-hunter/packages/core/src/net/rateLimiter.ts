import { AppError } from '../domain/errors.js';

/**
 * Sliding-window rate limiter, one instance per external provider.
 *
 * `acquire()` waits rather than throwing: an over-eager caller is slowed down,
 * not failed. That keeps us inside a provider's published limits by construction
 * instead of hoping the caller behaves.
 */
export class RateLimiter {
  private readonly hits: number[] = [];

  constructor(
    readonly name: string,
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {
    if (limit <= 0) throw new Error(`RateLimiter(${name}): limit must be positive`);
  }

  private prune(t: number): void {
    const cutoff = t - this.windowMs;
    while (this.hits.length > 0 && this.hits[0]! <= cutoff) this.hits.shift();
  }

  /** Number of calls still permitted in the current window. */
  remaining(): number {
    this.prune(this.now());
    return Math.max(0, this.limit - this.hits.length);
  }

  /** Wait until a slot is free, then consume it. */
  async acquire(maxWaitMs = 60_000): Promise<void> {
    const deadline = this.now() + maxWaitMs;
    for (;;) {
      const t = this.now();
      this.prune(t);
      if (this.hits.length < this.limit) {
        this.hits.push(t);
        return;
      }
      const oldest = this.hits[0]!;
      const waitMs = Math.max(1, oldest + this.windowMs - t);
      if (t + waitMs > deadline) {
        throw new AppError(
          'RATE_LIMITED',
          `${this.name}: local rate limit would require waiting ${waitMs}ms`,
          { retryable: true },
        );
      }
      await this.sleep(waitMs);
    }
  }
}

const registry = new Map<string, RateLimiter>();

/** One limiter per provider name, shared process-wide. */
export function getRateLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  const existing = registry.get(name);
  if (existing) return existing;
  const created = new RateLimiter(name, limit, windowMs);
  registry.set(name, created);
  return created;
}

/** Test helper. */
export function resetRateLimiters(): void {
  registry.clear();
}
