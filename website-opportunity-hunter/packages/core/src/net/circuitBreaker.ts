import { AppError } from '../domain/errors.js';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Stops us from hammering a provider that is already failing — which is both
 * rude and pointless. After `failureThreshold` consecutive failures the breaker
 * opens for `resetTimeoutMs`; the next call afterwards is a single trial.
 */
export class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;

  constructor(
    readonly name: string,
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  get currentState(): BreakerState {
    this.refresh();
    return this.state;
  }

  private refresh(): void {
    if (this.state === 'OPEN' && this.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.refresh();
    if (this.state === 'OPEN') {
      throw new AppError('CIRCUIT_OPEN', `${this.name}: circuit is open`, { retryable: true });
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'CLOSED';
      return result;
    } catch (err) {
      this.failures += 1;
      if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        this.openedAt = this.now();
      }
      throw err;
    }
  }
}

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  failureThreshold = 5,
  resetTimeoutMs = 60_000,
): CircuitBreaker {
  const existing = registry.get(name);
  if (existing) return existing;
  const created = new CircuitBreaker(name, failureThreshold, resetTimeoutMs);
  registry.set(name, created);
  return created;
}

export function resetCircuitBreakers(): void {
  registry.clear();
}
