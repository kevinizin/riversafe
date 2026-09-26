import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../domain/errors.js';
import { CircuitBreaker, resetCircuitBreakers } from './circuitBreaker.js';
import { HttpClient, backoffDelay, safeEndpoint } from './httpClient.js';
import { RateLimiter } from './rateLimiter.js';
import { RobotsChecker, parseRobots } from './robots.js';

beforeEach(() => resetCircuitBreakers());

const response = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...init });

describe('RateLimiter', () => {
  it('allows up to the limit, then waits for the window to roll', async () => {
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const limiter = new RateLimiter('test', 2, 1000, () => now, sleep);

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.remaining()).toBe(0);
    await limiter.acquire();
    expect(sleep).toHaveBeenCalledOnce();
    expect(now).toBeGreaterThanOrEqual(1000);
  });

  it('throws rather than waiting past the caller deadline', async () => {
    let now = 0;
    const limiter = new RateLimiter('test', 1, 60_000, () => now, async () => {});
    await limiter.acquire();
    await expect(limiter.acquire(10)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('CircuitBreaker', () => {
  it('opens after repeated failures and refuses further calls', async () => {
    let now = 0;
    const breaker = new CircuitBreaker('test', 2, 1000, () => now);
    const failing = () => Promise.reject(new Error('boom'));

    await expect(breaker.run(failing)).rejects.toThrow('boom');
    await expect(breaker.run(failing)).rejects.toThrow('boom');
    expect(breaker.currentState).toBe('OPEN');
    await expect(breaker.run(failing)).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
  });

  it('half-opens after the reset timeout and closes on success', async () => {
    let now = 0;
    const breaker = new CircuitBreaker('test', 1, 1000, () => now);
    await expect(breaker.run(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    now += 1500;
    expect(breaker.currentState).toBe('HALF_OPEN');
    await expect(breaker.run(async () => 'ok')).resolves.toBe('ok');
    expect(breaker.currentState).toBe('CLOSED');
  });
});

describe('backoffDelay', () => {
  it('grows exponentially and stays under the ceiling', () => {
    expect(backoffDelay(0, 500, 8000, () => 1)).toBe(500);
    expect(backoffDelay(3, 500, 8000, () => 1)).toBe(4000);
    expect(backoffDelay(10, 500, 8000, () => 1)).toBe(8000);
    expect(backoffDelay(3, 500, 8000, () => 0)).toBe(0);
  });
});

describe('safeEndpoint', () => {
  it('drops the query string so API keys never reach a log line', () => {
    expect(safeEndpoint('https://api.example.com/search?key=SECRET&q=x')).toBe('https://api.example.com/search');
  });
});

describe('HttpClient', () => {
  it('retries a 503 and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response('nope', { status: 503 }))
      .mockResolvedValueOnce(response('yes'));
    const client = new HttpClient({ name: 't', fetchImpl: fetchImpl as unknown as typeof fetch, baseDelayMs: 1 });
    const res = await client.request({ url: 'https://x.example.com/' });
    expect(res.text).toBe('yes');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404 and surfaces it when expected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('missing', { status: 404 }));
    const client = new HttpClient({ name: 't', fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await client.request({ url: 'https://x.example.com/', expectedStatuses: [404] });
    expect(res.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('reports an abort as a TIMEOUT error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const client = new HttpClient({ name: 't', fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 0 });
    await expect(client.request({ url: 'https://x.example.com/' })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('truncates a body larger than the cap', async () => {
    const big = 'a'.repeat(5000);
    const fetchImpl = vi.fn().mockResolvedValue(response(big));
    const client = new HttpClient({ name: 't', fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await client.request({ url: 'https://x.example.com/', maxBytes: 1000 });
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBeLessThanOrEqual(1000);
  });

  it('records every attempt for API usage accounting', async () => {
    const onCall = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(response('ok'));
    const client = new HttpClient({ name: 't', fetchImpl: fetchImpl as unknown as typeof fetch, onCall });
    await client.request({ url: 'https://x.example.com/path?key=SECRET' });
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 't', endpoint: 'https://x.example.com/path', ok: true }),
    );
  });
});

describe('parseRobots', () => {
  it('picks the wildcard group and ignores an empty Disallow', () => {
    const rules = parseRobots('User-agent: *\nDisallow:\nAllow: /public\n', 'bot');
    expect(rules.disallow).toEqual([]);
    expect(rules.allow).toEqual(['/public']);
  });

  it('prefers a group naming our user agent', () => {
    const rules = parseRobots(
      'User-agent: *\nDisallow: /\n\nUser-agent: mybot\nDisallow: /private\n',
      'MyBot/1.0',
    );
    expect(rules.disallow).toEqual(['/private']);
  });

  it('reads crawl-delay', () => {
    expect(parseRobots('User-agent: *\nCrawl-delay: 5\n', 'bot').crawlDelaySeconds).toBe(5);
  });
});

describe('RobotsChecker', () => {
  const checker = (robotsBody: string, status = 200) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(robotsBody, { status, headers: { 'content-type': 'text/plain' } }),
    );
    const http = new HttpClient({ name: 'website', fetchImpl: fetchImpl as unknown as typeof fetch, maxRetries: 0 });
    return new RobotsChecker(http, 'WebsiteOpportunityHunter/0.1', true);
  };

  it('blocks a disallowed path and allows the rest', async () => {
    const c = checker('User-agent: *\nDisallow: /private\n');
    expect((await c.check('https://x.example.com/private/page')).allowed).toBe(false);
    expect((await c.check('https://x.example.com/about')).allowed).toBe(true);
  });

  it('lets a longer Allow override a broad Disallow', async () => {
    const c = checker('User-agent: *\nDisallow: /\nAllow: /public/page\n');
    expect((await c.check('https://x.example.com/public/page')).allowed).toBe(true);
    expect((await c.check('https://x.example.com/other')).allowed).toBe(false);
  });

  it('treats an unreadable robots.txt as disallowed', async () => {
    const c = checker('forbidden', 403);
    expect((await c.check('https://x.example.com/')).allowed).toBe(false);
  });

  it('allows everything when robots.txt is missing', async () => {
    const c = checker('not found', 404);
    expect((await c.check('https://x.example.com/')).allowed).toBe(true);
  });

  it('can be disabled by configuration', async () => {
    const http = new HttpClient({ name: 'website', fetchImpl: (() => {
      throw new AppError('PROVIDER_UNAVAILABLE', 'should not be called');
    }) as unknown as typeof fetch });
    const c = new RobotsChecker(http, 'bot', false);
    expect((await c.check('https://x.example.com/')).allowed).toBe(true);
  });
});
