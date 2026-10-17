import { AppError } from '../../domain/errors.js';
import { HttpClient, type HttpClientOptions } from '../../net/httpClient.js';
import { getRateLimiter } from '../../net/rateLimiter.js';
import type { WebSearchOptions, WebSearchProvider, WebSearchResult } from './types.js';

/**
 * Google Programmable Search (Custom Search JSON API).
 *   GET https://www.googleapis.com/customsearch/v1?key=&cx=&q=
 * `num` is capped at 10 by the API.
 */
interface CseResponse {
  items?: { title?: string; link?: string; snippet?: string }[];
}

const PROVIDER = 'google_cse';

export class GoogleCseProvider implements WebSearchProvider {
  readonly name = PROVIDER;
  private readonly http: HttpClient;

  constructor(
    private readonly apiKey: string,
    private readonly cx: string,
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
    return this.apiKey.trim().length > 0 && this.cx.trim().length > 0;
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    if (!this.isConfigured()) {
      throw new AppError('PROVIDER_NOT_CONFIGURED', 'Google CSE key or cx is not set');
    }
    const params = new URLSearchParams({
      key: this.apiKey,
      cx: this.cx,
      q: query,
      num: String(Math.min(options.count ?? 10, 10)),
    });
    if (options.countryCode) params.set('gl', options.countryCode.toLowerCase());

    const res = await this.http.request({
      url: `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
      headers: { accept: 'application/json' },
    });

    let body: CseResponse;
    try {
      body = JSON.parse(res.text) as CseResponse;
    } catch (err) {
      throw new AppError('INVALID_RESPONSE', 'google_cse returned non-JSON', { cause: err });
    }
    return (body.items ?? [])
      .filter((i): i is { title?: string; link: string; snippet?: string } => typeof i.link === 'string')
      .map((i) => ({ title: i.title ?? '', url: i.link, snippet: i.snippet ?? '' }));
  }
}
