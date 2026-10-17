import { AppError, describeError } from '../domain/errors.js';
import type { HttpClient } from '../net/httpClient.js';
import type { RobotsChecker } from '../net/robots.js';

export type FetchErrorCode =
  | 'ROBOTS_DISALLOWED'
  | 'WEBSITE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'NOT_HTML'
  | 'RESPONSE_TOO_LARGE';

export interface PageFetch {
  ok: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  html?: string;
  bytes?: number;
  responseTimeMs?: number;
  errorCode?: FetchErrorCode;
  errorMessage?: string;
  /** Crawl-delay the host asked for, if any. Honoured between pages. */
  crawlDelaySeconds?: number;
}

export interface FetchPageDeps {
  http: HttpClient;
  robots: RobotsChecker;
}

/**
 * Fetches one page of a prospect's website.
 *
 * Three rules are non-negotiable here:
 *  - robots.txt is consulted first and a disallow ends the attempt;
 *  - a 401/403/CAPTCHA response is recorded and accepted, never worked around;
 *  - the body is size-capped and time-capped.
 */
export async function fetchPage(url: string, deps: FetchPageDeps): Promise<PageFetch> {
  const decision = await deps.robots.check(url);
  if (!decision.allowed) {
    return { ok: false, url, errorCode: 'ROBOTS_DISALLOWED', errorMessage: decision.reason };
  }

  try {
    const res = await deps.http.request({
      url,
      expectedStatuses: [401, 403, 404, 410, 429, 500, 502, 503],
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return {
        ok: false,
        url,
        finalUrl: res.url,
        status: res.status,
        responseTimeMs: res.durationMs,
        errorCode: 'NOT_HTML',
        errorMessage: `content-type was ${contentType}`,
      };
    }

    if (res.status >= 400) {
      return {
        ok: false,
        url,
        finalUrl: res.url,
        status: res.status,
        responseTimeMs: res.durationMs,
        errorCode: 'HTTP_ERROR',
        errorMessage: `the site responded ${res.status}`,
        ...(decision.crawlDelaySeconds !== undefined ? { crawlDelaySeconds: decision.crawlDelaySeconds } : {}),
      };
    }

    return {
      ok: true,
      url,
      finalUrl: res.url,
      status: res.status,
      html: res.text,
      bytes: Buffer.byteLength(res.text, 'utf8'),
      responseTimeMs: res.durationMs,
      ...(res.truncated ? { errorCode: 'RESPONSE_TOO_LARGE' as const } : {}),
      ...(decision.crawlDelaySeconds !== undefined ? { crawlDelaySeconds: decision.crawlDelaySeconds } : {}),
    };
  } catch (err) {
    const { code, message } = describeError(err);
    const mapped: FetchErrorCode =
      code === 'TIMEOUT' ? 'TIMEOUT' : code === 'HTTP_ERROR' ? 'HTTP_ERROR' : 'WEBSITE_UNAVAILABLE';
    return {
      ok: false,
      url,
      errorCode: mapped,
      errorMessage: message,
      ...(err instanceof AppError && err.status ? { status: err.status } : {}),
    };
  }
}
