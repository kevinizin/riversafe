import { AppError } from '../../domain/errors.js';
import { HttpClient, type HttpClientOptions } from '../../net/httpClient.js';
import { getRateLimiter } from '../../net/rateLimiter.js';
import type { WebSearchOptions, WebSearchProvider, WebSearchResult } from './types.js';

/**
 * Brave Search API.
 *   GET https://api.search.brave.com/res/v1/web/search
 *   Header: X-Subscription-Token
 * Parameters used: q, count (max 20), country.
 */
interface BraveResponse {
  web?: { results?: { title?: string; url?: string; description?: string }[] };
}

const PROVIDER = 'brave_search';

export class BraveSearchProvider implements WebSearchProvider {
  readonly name = PROVIDER;
  private readonly http: HttpClient;

  constructor(
    private readonly apiKey: string,
    opts: { rateLimit?: number; rateWindowMs?: number; fetchImpl?: typeof fetch; onCall?: HttpClientOptions['onCall'] } = {},
  ) {
    this.http = new HttpClient({
      name: PROVIDER,
      rateLimiter: getRateLimiter(PROVIDER, opts.rateLimit ?? 60, opts.rateWindowMs ?? 60_000),
      maxRetries: 2,
      defaultTimeoutMs: 10_000,
      defaultMaxBytes: 2_000_000,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.onCall ? { onCall: opts.onCall } : {}),
    });
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    if (!this.isConfigured()) {
      throw new AppError('PROVIDER_NOT_CONFIGURED', 'Brave Search API key is not set');
    }
    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(options.count ?? 10, 20)),
    });
    if (options.countryCode) params.set('country', options.countryCode.toUpperCase());

    const res = await this.http.request({
      url: `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      headers: { accept: 'application/json', 'x-subscription-token': this.apiKey },
    });

    let body: BraveResponse;
    try {
      body = JSON.parse(res.text) as BraveResponse;
    } catch (err) {
      throw new AppError('INVALID_RESPONSE', 'brave_search returned non-JSON', { cause: err });
    }
    return (body.web?.results ?? [])
      .filter((r): r is { title?: string; url: string; description?: string } => typeof r.url === 'string')
      .map((r) => ({ title: r.title ?? '', url: r.url, snippet: r.description ?? '' }));
  }
}
